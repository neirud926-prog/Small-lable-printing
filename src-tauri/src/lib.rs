use std::process::Command;
use std::sync::Mutex;
use tauri::command;

// ── Print serialization lock ───────────────────────────────────────────────────
// Ensures that concurrent label prints never interleave their printer-switch
// operations.  One job runs to completion before the next one begins.
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
        return Err(format!("Cannot select printer '{}': {}", name, err.trim()));
    }
    Ok(())
}

/// Find the first Chromium-based browser installed that supports --kiosk-printing.
/// Returns the full path, or None if none are found.
fn find_kiosk_browser() -> Option<String> {
    // Fixed installation paths (most common)
    let fixed: &[&str] = &[
        // Microsoft Edge
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        // Google Chrome (machine-wide)
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        // Brave
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
    ];

    // Per-user Chrome / Edge installation under %LOCALAPPDATA%
    let user_paths: Vec<String> = std::env::var("LOCALAPPDATA")
        .map(|base| {
            vec![
                format!(r"{}\Google\Chrome\Application\chrome.exe", base),
                format!(r"{}\Microsoft\Edge\Application\msedge.exe", base),
            ]
        })
        .unwrap_or_default();

    fixed
        .iter()
        .map(|s| s.to_string())
        .chain(user_paths)
        .find(|p| std::path::Path::new(p).exists())
}

// ── PowerShell / System.Drawing print script ─────────────────────────────────

/// Build the PowerShell script that renders a small label using System.Drawing
/// and sends it directly to the named printer — no browser required.
/// `data_file` must be a forward-slash path to the JSON data file.
fn build_ps_print_script(data_file: &str) -> String {
    // Use simple string replacement so we never have to escape curly braces
    // in a Rust format! call against PowerShell syntax.
    let template = r#"
Add-Type -AssemblyName System.Drawing

$script:d = Get-Content 'DATA_FILE' -Raw | ConvertFrom-Json

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = $script:d.printerName
if (-not $pd.PrinterSettings.IsValid) {
    throw "Printer '$($script:d.printerName)' not found or inaccessible. Check Settings -> Thermal Printer."
}

$pd.add_PrintPage({
    param($sender, $e)
    $g  = $e.Graphics
    $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
    $d  = $script:d

    $blk = [System.Drawing.Brushes]::Black
    $wht = [System.Drawing.Brushes]::White
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 0.25)

    $pl = [double]$d.padLeft
    $pr = [double]$d.padRight
    $pt = [double]$d.padTop
    $pb = [double]$d.padBottom
    $w  = [double]$d.widthMm
    $h  = [double]$d.heightMm

    $hasExp  = ($d.ipop -eq 'IP') -and ([string]$d.expiry -ne '') -and ([string]$d.expiry -ne 'na----')
    $footerH = 4.8
    $batchH  = 4.5
    $expH    = if ($hasExp) { 3.2 } else { 0 }
    $drugH   = $h - $pt - $pb - $footerH - $batchH - $expH

    # ── Drug name ──────────────────────────────────────────────────────────────
    $dfs = [double]$d.drugFontSize
    if ([bool]$d.isSmallFont) { $dfs = [Math]::Max($dfs - 1.5, 5) }
    $dfStyle = if ([bool]$d.drugFontBold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $dfont   = New-Object System.Drawing.Font([string]$d.fontFamily, $dfs, $dfStyle)

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $sf.Trimming      = [System.Drawing.StringTrimming]::Word

    $drugRect = [System.Drawing.RectangleF]::new($pl, $pt, ($w - $pl - $pr), $drugH)
    if ([bool]$d.isBlackBg) {
        $g.FillRectangle([System.Drawing.Brushes]::Black, $drugRect)
        $g.DrawString([string]$d.drugName, $dfont, $wht, $drugRect, $sf)
    } else {
        $g.DrawString([string]$d.drugName, $dfont, $blk, $drugRect, $sf)
    }

    $y = $pt + $drugH

    # ── Expiry (IP labels only) ────────────────────────────────────────────────
    if ($hasExp) {
        $eStyle = if ([bool]$d.expFontBold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
        $ef = New-Object System.Drawing.Font([string]$d.fontFamily, [double]$d.expFontSize, $eStyle)
        $g.DrawString("$([string]$d.expiryLabel) $([string]$d.expiry)", $ef, $blk, $pl, $y)
        $y += $expH
    }

    # ── Batch No ───────────────────────────────────────────────────────────────
    $bfBold   = New-Object System.Drawing.Font([string]$d.fontFamily, [double]$d.batchFontSize, [System.Drawing.FontStyle]::Bold)
    $bvStyle  = if ([bool]$d.batchFontBold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $bfValue  = New-Object System.Drawing.Font([string]$d.fontFamily, [double]$d.batchFontSize, $bvStyle)
    $bSz    = $g.MeasureString("Bat. No.:", $bfBold)
    $batX   = $pl + $bSz.Width
    $charHB = [double]$d.batchFontSize * 0.353
    $lineY  = $y + 0.4 + $charHB * 0.85
    $g.DrawString("Bat. No.:", $bfBold,  $blk, $pl,   ($y + 0.4))
    $g.DrawString([string]$d.batchNo, $bfValue, $blk, $batX, ($y + 0.4))
    if ([bool]$d.batchUnderline) {
        $g.DrawLine($pen, $batX, $lineY, ($w - $pr), $lineY)
    }
    $y += $batchH

    # ── Footer: Packed by / Checked by ────────────────────────────────────────
    $sStyle = if ([bool]$d.signFontBold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $sfont = New-Object System.Drawing.Font([string]$d.fontFamily, [double]$d.signFontSize, $sStyle)
    $halfW = ($w - $pl - $pr) / 2.0

    # Place the underline right at the text baseline.
    # 1 pt = 25.4/72 mm ≈ 0.353 mm; baseline ≈ 80 % of character height from top.
    $charH  = [double]$d.signFontSize * 0.353
    $fLineY = $y + $charH * 0.85

    # Measure actual rendered text widths so each line starts immediately
    # after its label (no hardcoded offsets that break at other font sizes).
    $psz = $g.MeasureString("Packed by:",  $sfont)
    $csz = $g.MeasureString("Checked by:", $sfont)

    $g.DrawString("Packed by:",  $sfont, $blk, $pl, $y)
    $g.DrawLine($pen, ($pl + $psz.Width), $fLineY, ($pl + $halfW - 0.5), $fLineY)

    $rx = $pl + $halfW + 1.0
    $g.DrawString("Checked by:", $sfont, $blk, $rx, $y)
    $g.DrawLine($pen, ($rx + $csz.Width), $fLineY, ($w - $pr), $fLineY)

    $e.HasMorePages = $false
})

$pd.Print()
Write-Host "OK: label sent to $($script:d.printerName)"
"#;
    template.replace("DATA_FILE", data_file)
}

// ── Drug Reconstitution label print script (50/50 split) ─────────────────────

/// Build the PowerShell script that renders a Drug Reconstitution label.
/// Layout: 50% upper half = "Batch No:" + value, 50% lower half = "Use Before:" + value.
fn build_ps_recon_print_script(data_file: &str) -> String {
    let template = r#"
Add-Type -AssemblyName System.Drawing

$script:d = Get-Content 'DATA_FILE' -Raw | ConvertFrom-Json

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = $script:d.printerName
if (-not $pd.PrinterSettings.IsValid) {
    throw "Printer '$($script:d.printerName)' not found or inaccessible. Check Settings -> Thermal Printer."
}

$pd.add_PrintPage({
    param($sender, $e)
    $g  = $e.Graphics
    $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
    $d  = $script:d

    $blk = [System.Drawing.Brushes]::Black
    $wht = [System.Drawing.Brushes]::White
    $w   = [double]$d.widthMm
    $h   = [double]$d.heightMm

    $padX = 1.0
    $halfH = $h / 2.0

    $titlePt = [double]$d.titleFontSize
    $valuePt = [double]$d.valueFontSize
    $titleStyle = if ([bool]$d.titleFontBold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $valueStyle = if ([bool]$d.valueFontBold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $titleFont = New-Object System.Drawing.Font([string]$d.fontFamily, $titlePt, $titleStyle)
    $valueFont = New-Object System.Drawing.Font([string]$d.fontFamily, $valuePt, $valueStyle)

    $titleH = $titlePt * 0.353 * 1.25
    $valueH = $valuePt * 0.353 * 1.25
    $stackH = $titleH + $valueH + 0.4
    $topPad = ($halfH - $stackH) / 2.0
    if ($topPad -lt 0.3) { $topPad = 0.3 }

    # Upper half background — black fill for flagged items (e.g. AUGM06)
    $topBg = [bool]$d.topBlackBg
    if ($topBg) {
        $g.FillRectangle([System.Drawing.Brushes]::Black, 0.0, 0.0, $w, $halfH)
    }
    $topBrush = if ($topBg) { $wht } else { $blk }

    # Upper half: Batch No
    $y0 = $topPad
    $g.DrawString("Batch No:",            $titleFont, $topBrush, $padX, $y0)
    $g.DrawString([string]$d.batchNo,     $valueFont, $topBrush, $padX, ($y0 + $titleH + 0.4))

    # Lower half: Use Before (always white background, black text)
    $y1 = $halfH + $topPad
    $g.DrawString("Use Before:",          $titleFont, $blk, $padX, $y1)
    $g.DrawString([string]$d.expiry,      $valueFont, $blk, $padX, ($y1 + $titleH + 0.4))

    $e.HasMorePages = $false
})

$pd.Print()
Write-Host "OK: reconstitution label sent to $($script:d.printerName)"
"#;
    template.replace("DATA_FILE", data_file)
}

/// Native silent print for the Drug Reconstitution label (50/50 split layout).
#[command]
fn print_reconstitution_label_powershell(
    batch_no: String,
    expiry: String,
    printer_name: String,
    width_mm: f64,
    height_mm: f64,
    title_font_size: f64,
    title_font_bold: bool,
    value_font_size: f64,
    value_font_bold: bool,
    font_family: String,
    top_black_bg: Option<bool>,
) -> Result<(), String> {
    let _lock = PRINT_LOCK
        .lock()
        .map_err(|_| "Print queue error: lock poisoned".to_string())?;

    let data = serde_json::json!({
        "batchNo":        batch_no,
        "expiry":         expiry,
        "printerName":    printer_name,
        "widthMm":        width_mm,
        "heightMm":       height_mm,
        "titleFontSize":  title_font_size,
        "titleFontBold":  title_font_bold,
        "valueFontSize":  value_font_size,
        "valueFontBold":  value_font_bold,
        "fontFamily":     font_family,
        "topBlackBg":     top_black_bg.unwrap_or(false),
    });

    let temp_dir = std::env::temp_dir();
    let data_path = temp_dir.join("sml_recon_print_data.json");
    let script_path = temp_dir.join("sml_recon_print.ps1");

    std::fs::write(&data_path, data.to_string().as_bytes())
        .map_err(|e| format!("Failed to write print data: {}", e))?;

    let data_path_fwd = data_path
        .to_str()
        .unwrap_or("")
        .replace('\\', "/");

    let script = build_ps_recon_print_script(&data_path_fwd);
    std::fs::write(&script_path, script.as_bytes())
        .map_err(|e| format!("Failed to write print script: {}", e))?;

    let out = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script_path.to_str().unwrap_or(""),
        ])
        .output()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!("Native recon print error: {}", detail));
    }

    Ok(())
}

// ── GTIN label (QR code) print script ────────────────────────────────────────

fn build_ps_gtin_label_script(data_path: &str) -> String {
    format!(
        r#"
Add-Type -AssemblyName System.Drawing
$d = Get-Content '{data_path}' | ConvertFrom-Json

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = $d.printerName
if (-not $pd.PrinterSettings.IsValid) {{
    throw "Printer '$($d.printerName)' not found or inaccessible. Check Settings -> Thermal Printer."
}}

$w100 = [int]([double]$d.widthMm  / 25.4 * 100)
$h100 = [int]([double]$d.heightMm / 25.4 * 100)
$pd.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("Custom", $w100, $h100)
$pd.DefaultPageSettings.Landscape = $false
$pd.DefaultPageSettings.Margins   = New-Object System.Drawing.Printing.Margins(0,0,0,0)

$pd.add_PrintPage({{
    param($sender, $e)
    $g = $e.Graphics
    $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter

    $w = [double]$d.widthMm
    $h = [double]$d.heightMm

    # Decode base64 PNG -> Image
    $imgBytes = [Convert]::FromBase64String($d.imageBase64)
    $ms  = New-Object System.IO.MemoryStream(,$imgBytes)
    $img = [System.Drawing.Image]::FromStream($ms)

    # Layout: QR code square centred; text height derived from font size
    $pad      = 0.5
    $fontPt   = [double]$d.itemCodeFontPt
    $textH    = $fontPt * 0.353 * 2.2
    $qrReq    = [double]$d.qrSizeMm
    if ($qrReq -gt 0) {{
        $codeSize = $qrReq
    }} else {{
        $codeSize = $h - $textH - $pad * 2
        if ($codeSize -gt ($w - $pad * 2)) {{ $codeSize = $w - $pad * 2 }}
    }}
    $codeX = ($w - $codeSize) / 2
    $codeY = $pad

    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.DrawImage($img, [float]$codeX, [float]$codeY, [float]$codeSize, [float]$codeSize)
    $img.Dispose(); $ms.Dispose()

    # Item code centred below the QR code
    $font  = New-Object System.Drawing.Font("Arial", [float]$fontPt, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
    $brush = [System.Drawing.Brushes]::Black
    $sz    = $g.MeasureString($d.itemCode, $font)
    $tx    = ($w - $sz.Width) / 2
    $ty    = $codeY + $codeSize + 0.5
    $g.DrawString($d.itemCode, $font, $brush, [float]$tx, [float]$ty)
    $font.Dispose()
}})

$pd.Print()
$pd.Dispose()
Write-Host "OK: GTIN label sent to $($d.printerName)"
"#,
        data_path = data_path
    )
}

/// Print a single QR-code GTIN label silently via PowerShell + System.Drawing.
/// The caller passes a base64-encoded PNG of the QR code; this function renders
/// it onto the label together with the item code text (5 pt, centred).
#[command]
fn print_gtin_label(
    image_base64: String,
    item_code: String,
    printer_name: String,
    width_mm: f64,
    height_mm: f64,
    qr_size_mm: f64,
    item_code_font_pt: f64,
) -> Result<(), String> {
    let _lock = PRINT_LOCK
        .lock()
        .map_err(|_| "Print queue error: lock poisoned".to_string())?;

    let item_code_font_pt = if item_code_font_pt > 0.0 { item_code_font_pt } else { 5.0 };
    let data = serde_json::json!({
        "imageBase64":    image_base64,
        "itemCode":       item_code,
        "printerName":    printer_name,
        "widthMm":        width_mm,
        "heightMm":       height_mm,
        "qrSizeMm":       qr_size_mm,
        "itemCodeFontPt": item_code_font_pt,
    });

    let temp_dir   = std::env::temp_dir();
    let data_path  = temp_dir.join("sml_gtin_data.json");
    let script_path = temp_dir.join("sml_gtin_print.ps1");

    std::fs::write(&data_path, data.to_string().as_bytes())
        .map_err(|e| format!("Failed to write GTIN print data: {}", e))?;

    let data_path_fwd = data_path
        .to_str()
        .unwrap_or("")
        .replace('\\', "/");

    let script = build_ps_gtin_label_script(&data_path_fwd);
    std::fs::write(&script_path, script.as_bytes())
        .map_err(|e| format!("Failed to write GTIN print script: {}", e))?;

    let out = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script_path.to_str().unwrap_or(""),
        ])
        .output()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!("GTIN label print error: {}", detail));
    }

    Ok(())
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Return a list of all printer names installed on this Windows machine.
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

/// Native silent print using PowerShell + System.Drawing — no browser required.
///
/// Renders the label with GDI fonts/lines and sends the job directly to the
/// named printer.  Works even when browsers are blocked by Group Policy.
/// Currently handles the "small" label layout (34.4 × 25 mm).
#[command]
fn print_label_powershell(
    drug_name: String,
    expiry: String,
    batch_no: String,
    ipop: String,
    is_black_bg: bool,
    is_small_font: bool,
    printer_name: String,
    width_mm: f64,
    height_mm: f64,
    drug_font_size: f64,
    batch_font_size: f64,
    sign_font_size: f64,
    font_family: String,
    drug_font_bold: bool,
    pad_left: f64,
    pad_right: f64,
    pad_top: f64,
    pad_bottom: f64,
    expiry_label: String,
    batch_underline: bool,
    exp_font_size: f64,
    exp_font_bold: bool,
    batch_font_bold: bool,
    sign_font_bold: bool,
) -> Result<(), String> {
    let _lock = PRINT_LOCK
        .lock()
        .map_err(|_| "Print queue error: lock poisoned".to_string())?;

    // Serialise label data to a JSON temp file (avoids any shell-escaping problems)
    let data = serde_json::json!({
        "drugName":     drug_name,
        "expiry":       expiry,
        "batchNo":      batch_no,
        "ipop":         ipop,
        "isBlackBg":    is_black_bg,
        "isSmallFont":  is_small_font,
        "printerName":  printer_name,
        "widthMm":      width_mm,
        "heightMm":     height_mm,
        "drugFontSize":   drug_font_size,
        "batchFontSize":  batch_font_size,
        "signFontSize":   sign_font_size,
        "fontFamily":     font_family,
        "drugFontBold":   drug_font_bold,
        "padLeft":        pad_left,
        "padRight":       pad_right,
        "padTop":         pad_top,
        "padBottom":      pad_bottom,
        "expiryLabel":    expiry_label,
        "batchUnderline": batch_underline,
        "expFontSize":    exp_font_size,
        "expFontBold":    exp_font_bold,
        "batchFontBold":  batch_font_bold,
        "signFontBold":   sign_font_bold,
    });

    let temp_dir = std::env::temp_dir();
    let data_path = temp_dir.join("sml_print_data.json");
    let script_path = temp_dir.join("sml_print.ps1");

    std::fs::write(&data_path, data.to_string().as_bytes())
        .map_err(|e| format!("Failed to write print data: {}", e))?;

    // Forward slashes work in PowerShell and avoid backslash escape issues
    let data_path_fwd = data_path
        .to_str()
        .unwrap_or("")
        .replace('\\', "/");

    let script = build_ps_print_script(&data_path_fwd);
    std::fs::write(&script_path, script.as_bytes())
        .map_err(|e| format!("Failed to write print script: {}", e))?;

    let out = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script_path.to_str().unwrap_or(""),
        ])
        .output()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!("Native print error: {}", detail));
    }

    Ok(())
}

/// Print a label HTML string silently via a Chromium browser in kiosk-printing mode.
///
/// Tries Edge → Chrome → Brave in order.  If `printer_name` is set it is
/// temporarily made the Windows default so kiosk-mode prints to the right device.
#[command]
fn print_label_html(
    html: String,
    css: String,
    width_mm: f64,
    height_mm: f64,
    printer_name: String,
) -> Result<(), String> {
    let _lock = PRINT_LOCK
        .lock()
        .map_err(|_| "Print queue error: internal lock was poisoned".to_string())?;

    // ── Build self-contained HTML ─────────────────────────────────────────────
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

    let temp_dir = std::env::temp_dir();
    let html_path = temp_dir.join("sml_label_print.html");
    std::fs::write(&html_path, full_html.as_bytes())
        .map_err(|e| format!("Failed to write temp label file: {}", e))?;

    let file_url = format!(
        "file:///{}",
        html_path.to_str().unwrap_or("").replace('\\', "/")
    );

    // ── Printer selection ─────────────────────────────────────────────────────
    let original_printer = if !printer_name.is_empty() {
        let orig = get_default_printer();
        set_default_printer(&printer_name)?;
        orig
    } else {
        String::new()
    };

    // ── Find a kiosk-capable browser ─────────────────────────────────────────
    // Tries Edge → Chrome → Brave.  Error message lists all paths checked so
    // IT can quickly diagnose which browser to allow in Group Policy.
    let browser_path = match find_kiosk_browser() {
        Some(p) => p,
        None => {
            if !original_printer.is_empty() {
                let _ = set_default_printer(&original_printer);
            }
            return Err(
                "No supported browser found (checked Edge, Chrome, Brave). \
                 Enable 'Silent print (native)' in Settings to print without a browser."
                    .to_string(),
            );
        }
    };

    // ── Spawn the browser ─────────────────────────────────────────────────────
    let mut child = match Command::new(&browser_path)
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
            // Give a clear hint if Group Policy is the culprit (error 1260)
            let hint = if e.raw_os_error() == Some(1260) {
                " (blocked by Group Policy — use 'Silent print (native)' in Settings instead)"
            } else {
                ""
            };
            return Err(format!("Failed to launch browser{}: {}", hint, e));
        }
    };

    // ── Wait for browser to finish ────────────────────────────────────────────
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(7);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
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

/// Return the Windows COMPUTERNAME environment variable (empty string if unset).
#[command]
fn get_computer_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_default()
}

/// Query the GTIN table from a Microsoft Access .accdb file via PowerShell + OleDB.
#[command]
fn query_gtin_db(path: String) -> Result<Vec<serde_json::Value>, String> {
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
    $cmd.CommandText = "SELECT [Item Code], GTIN FROM GTIN"
    $reader = $cmd.ExecuteReader()
    $rows = @()
    while ($reader.Read()) {{
        $rows += [pscustomobject]@{{
            ItemCode = $reader["Item Code"].ToString().Trim()
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
            print_label_powershell,
            print_reconstitution_label_powershell,
            print_gtin_label,
            list_printers,
            get_computer_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
