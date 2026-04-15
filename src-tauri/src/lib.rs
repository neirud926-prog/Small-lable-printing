use std::process::Command;
use std::sync::Mutex;
use tauri::command;

// ── Print serialization lock ───────────────────────────────────────────────────
// Ensures that concurrent label prints never interleave their printer-switch
// operations.  One job runs to completion (printer set → Edge prints → printer
// restored) before the next one begins.
static PRINT_LOCK: Mutex<()> = Mutex::new(());

// ── PowerShell helpers ────────────────────────────────────────────────────────

fn ps_run(script: &str) -> std::io::Result<std::process::Output> {
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output()
}

/// Return the name of the current Windows default printer (empty string on error).
fn get_default_printer() -> String {
    let Ok(out) = ps_run(
        r#"Get-Printer | Where-Object { $_.Default -eq $true } | Select-Object -ExpandProperty Name -First 1"#,
    ) else {
        return String::new();
    };
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

/// Set the Windows default printer by name.
/// Returns `Err` with a human-readable message if the printer cannot be found.
fn set_default_printer(name: &str) -> Result<(), String> {
    let escaped = name.replace('\'', "''");
    let script = format!(
        r#"
$p = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='{name}'"
if (-not $p) {{ throw "Printer '{name}' not found on this machine" }}
$p.SetDefaultPrinter() | Out-Null
"#,
        name = escaped
    );
    let out = ps_run(&script).map_err(|e| format!("PowerShell error: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!(
            "Cannot select printer '{}': {}",
            name,
            err.trim()
        ));
    }
    Ok(())
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Return the names of all printers installed on this Windows machine.
#[command]
fn list_printers() -> Result<Vec<String>, String> {
    let out = ps_run(
        r#"Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"#,
    )
    .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Failed to list printers: {}", err.trim()));
    }

    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "null" {
        return Ok(vec![]);
    }

    // PowerShell emits a bare string when there is only one printer,
    // or a JSON array when there are multiple.
    let parsed: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("JSON parse error: {}", e))?;

    let names = match parsed {
        serde_json::Value::Array(arr) => arr
            .into_iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        serde_json::Value::String(s) => vec![s],
        _ => vec![],
    };

    Ok(names)
}

/// Print a label HTML string silently via Microsoft Edge in kiosk-printing mode.
///
/// If `printer_name` is non-empty the function will:
///   1. Save the current Windows default printer.
///   2. Set `printer_name` as the new default (fails fast if not found).
///   3. Launch Edge with `--kiosk-printing` so it prints without a dialog.
///   4. Wait for Edge to finish (≤ 7 s), then restore the original default.
///
/// A global mutex ensures that concurrent calls never interleave the
/// printer-switch, so multiple copies print correctly one-at-a-time.
#[command]
fn print_label_html(
    html: String,
    css: String,
    width_mm: f64,
    height_mm: f64,
    printer_name: String,
) -> Result<(), String> {
    // Acquire the print lock — released automatically when `_lock` drops at
    // the end of this function.
    let _lock = PRINT_LOCK
        .lock()
        .map_err(|_| "Print queue error: internal lock was poisoned".to_string())?;

    // ── Build self-contained HTML with auto-print script ──────────────────────
    let full_html = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
@page {{ size: {w}mm {h}mm; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ width: {w}mm; height: {h}mm; overflow: hidden; }}
{css}
</style>
</head>
<body>
{body}
<script>window.onload = function() {{
  window.print();
  setTimeout(function() {{ window.close(); }}, 2000);
}};</script>
</body>
</html>"#,
        w = width_mm,
        h = height_mm,
        css = css,
        body = html
    );

    // Write to temp file
    let temp_dir = std::env::temp_dir();
    let html_path = temp_dir.join("sml_label_print.html");
    std::fs::write(&html_path, full_html.as_bytes())
        .map_err(|e| format!("Failed to write temp label file: {}", e))?;

    let file_url = format!(
        "file:///{}",
        html_path.to_str().unwrap_or("").replace('\\', "/")
    );

    // ── Printer selection ─────────────────────────────────────────────────────
    // Save original default so we can restore it after printing.
    let original_printer = if !printer_name.is_empty() {
        let orig = get_default_printer();
        set_default_printer(&printer_name)?;
        orig
    } else {
        String::new()
    };

    // ── Locate Edge ───────────────────────────────────────────────────────────
    let edge_candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ];
    let edge_path = match edge_candidates
        .iter()
        .find(|p| std::path::Path::new(p).exists())
    {
        Some(p) => p.to_string(),
        None => {
            // Restore printer before returning an error
            if !original_printer.is_empty() {
                let _ = set_default_printer(&original_printer);
            }
            return Err(
                "Microsoft Edge not found. Please install Edge to enable silent printing."
                    .to_string(),
            );
        }
    };

    // ── Spawn Edge ────────────────────────────────────────────────────────────
    let mut child = match Command::new(&edge_path)
        .args([
            "--kiosk-printing",
            "--no-first-run",
            "--disable-sync",
            "--no-default-browser-check",
            "--window-size=1,1",
            &format!("--app={}", file_url),
        ])
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            if !original_printer.is_empty() {
                let _ = set_default_printer(&original_printer);
            }
            return Err(format!("Failed to launch Edge: {}", e));
        }
    };

    // ── Wait for Edge to finish (auto-closes after ~2 s via JS) ──────────────
    // Polling with a 7-second hard deadline keeps the lock held until printing
    // is truly done, so the next queued copy can safely swap the printer again.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(7);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break, // Edge exited naturally
            Ok(None) => {}
            Err(_) => break,
        }
        if std::time::Instant::now() >= deadline {
            let _ = child.kill();
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    // ── Restore original default printer ──────────────────────────────────────
    // Best-effort: if this fails the user still got their label printed.
    if !original_printer.is_empty() && original_printer != printer_name {
        let _ = set_default_printer(&original_printer);
    }

    Ok(())
}

/// Read any file as raw bytes — used by JS to pass binary (e.g. .xls) to SheetJS.
#[command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// Query the GTIN table from a Microsoft Access .accdb file via PowerShell + OleDB.
/// Returns JSON array of { ItemCode, GTIN } objects as a string.
#[command]
fn query_gtin_db(path: String) -> Result<Vec<serde_json::Value>, String> {
    // Escape single quotes in the path for PowerShell
    let safe_path = path.replace('\'', "''");

    let ps_script = format!(
        r#"
$ErrorActionPreference = 'Stop'
try {{
    Add-Type -AssemblyName System.Data
    $conn = New-Object System.Data.OleDb.OleDbConnection
    $conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source='{path}';"
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT ItemCode, GTIN FROM GTIN"
    $reader = $cmd.ExecuteReader()
    $rows = @()
    while ($reader.Read()) {{
        $rows += [pscustomobject]@{{
            ItemCode = $reader["ItemCode"].ToString().Trim()
            GTIN     = $reader["GTIN"].ToString().Trim()
        }}
    }}
    $reader.Close()
    $conn.Close()
    $rows | ConvertTo-Json -Compress
}} catch {{
    Write-Error $_.Exception.Message
    exit 1
}}
"#,
        path = safe_path
    );

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps_script,
        ])
        .output()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("PowerShell error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "null" {
        return Ok(vec![]);
    }

    // PowerShell returns either an object (1 row) or array; normalise to array
    let parsed: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("JSON parse error: {}", e))?;

    let arr = match parsed {
        serde_json::Value::Array(a) => a,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => vec![],
    };

    Ok(arr)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_binary_file,
            query_gtin_db,
            print_label_html,
            list_printers
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
