use std::process::Command;
use tauri::command;

/// Print a label HTML string silently via Microsoft Edge in kiosk-printing mode.
/// Edge's --kiosk-printing flag suppresses the print dialog and sends directly
/// to the default printer.  The command returns as soon as the Edge process is
/// spawned; a background thread kills it after ~6 s to clean up.
#[command]
fn print_label_html(html: String, css: String, width_mm: f64, height_mm: f64) -> Result<(), String> {
    // Build a self-contained HTML page that auto-prints on load
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
        w = width_mm, h = height_mm, css = css, body = html
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

    // Find Edge (x86 or 64-bit install)
    let edge_candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ];
    let edge_path = edge_candidates
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .map(|p| p.to_string())
        .ok_or_else(|| "Microsoft Edge not found on this machine".to_string())?;

    // Spawn Edge in app mode: kiosk-printing suppresses the print dialog,
    // --window-size=1,1 keeps the window tiny, auto-close via JS after print.
    let child = Command::new(&edge_path)
        .args([
            "--kiosk-printing",
            "--no-first-run",
            "--disable-sync",
            "--no-default-browser-check",
            "--window-size=1,1",
            &format!("--app={}", file_url),
        ])
        .spawn()
        .map_err(|e| format!("Failed to launch Edge: {}", e))?;

    // Kill Edge after 6 s in a background thread (fallback if window.close() fails)
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(6));
        let mut c = child;
        let _ = c.kill();
    });

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
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
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
        serde_json::Value::Array(a)  => a,
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
        .invoke_handler(tauri::generate_handler![read_binary_file, query_gtin_db, print_label_html])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
