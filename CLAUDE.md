# Small Label Printing — Project Context

Tauri 2.x desktop app for pharmacy label printing (React + Vite frontend, Rust backend).
Target: Windows pharmacy workstations.

## Repository
- GitHub: `neirud926-prog/Small-lable-printing`
- **Always commit and push to `main`** — GitHub Actions then builds `release/SmallLabelPrinting.exe`
- CI note: commits that include `[skip ci]` in the body will skip the build;
  push a plain source-file change to `main` to re-trigger if needed.

## Stack
| Layer | Tech |
|---|---|
| UI | React 18 + Vite, `src/` |
| Desktop shell | Tauri 2.x, `src-tauri/` |
| Printing | PowerShell + `System.Drawing` (GDI), invoked via `src-tauri/src/lib.rs` |
| Drug data | localStorage (imported from Excel via Maintenance page) |
| GTIN lookup | MS Access `.accdb` via OleDb in PowerShell |
| Settings | localStorage, defaults in `src/utils/storage.js` |

## Key files
```
src/
  utils/
    barcodeDecoder.js   GS1 AI parser (default) + legacy P0-P6 fallback
    storage.js          getSettings(), findDrugByCode(), findByGtin(), GTIN map
    labelPrint.js       buildSmallLabelHTML() + CSS for print/preview
    batchNumber.js      todayYYMMDD(), formatDateLabel()
  components/
    SmallLabelPrint.jsx Main scan/print page (Standard + Short-Exp tabs)
    Settings.jsx        All label settings + barcode decoder toggle
    Maintenance/
      index.jsx         Tab host (Import, ExpAfterOpen, GTIN viewer)
      GtinViewer.jsx    Read-only GTIN → ItemCode table loaded from Access DB
src-tauri/src/lib.rs    Rust commands: print_label, query_gtin_db, open_file_dialog
```

## Default label settings (src/utils/storage.js)
- Padding: 0 mm all sides
- Font family: Arial
- Drug name: 6 pt, bold
- Batch / Sign lines: 5 pt
- Barcode decoder method: `gs1` (GS1 AI parser)

## Barcode decoder (src/utils/barcodeDecoder.js)
### GS1 AI parser (default)
- Strips symbology identifiers: `]C1`, `]d2`, `]Q3`, `]e0`
- Normalises FNC1: ASCII 29 (`\u001d`) or `^` substitute
- **AI map used on label:**
  - `01` / `02` → GTIN-14 (02 is fallback if 01 absent)
  - `10` → Batch / Lot (variable length)
  - `17` → Expiry date YYMMDD (preferred)
  - `15` → Best-before date YYMMDD (fallback)
  - `11`, `21`, `90`-`99` → parsed but NOT placed on label
- **`findNextAIBoundary()`**: when a variable-length field has no FNC1 terminator,
  scans forward for the next valid date AI (11/15/17 with valid YYMMDD) or
  company-internal AI (90-99) to find the field boundary.
  Prevents batch from swallowing expiry + company data in HK pharma barcodes
  that omit FNC1 (e.g. `010489512660471510A520005A11727123190HK-28748`).

### Legacy fallback (P0–P6)
- Original positional patterns from MReadingBarCode.bas
- Used when GS1 parser returns null, or when user switches to "Legacy" in Settings

## Label logic (SmallLabelPrint.jsx)
- **6-char input** → OP label (no expiry)
- **GTIN barcode** → IP/OP modal → look up item code via GTIN map → resolve drug
  - IP: prints batch + expiry from barcode (user can edit expiry if blank)
  - OP: prints batch only — expiry field is always empty
- **13-char IP barcode** → IP label, item code = chars 5-10
- Expiry input accepts `DDMMYYYY` (auto-formats to `DD-Mon-YYYY`)

## GTIN lookup
- Access DB table: `GTIN`, columns `[Item Code]` (with space) and `GTIN`
- SQL: `SELECT [Item Code], GTIN FROM GTIN`
- PowerShell reader key: `$reader["Item Code"]`
- `normaliseGtin()` pads short GTINs (EAN-13 etc.) to 14 digits before lookup

## Print (PowerShell / GDI)
- Expiry line: bold font
- Bat. No. underline: uses `MeasureString()` for accurate `x` position
- Label padding defaults: all 0 mm

## Maintenance page tabs
1. Import Excel (Drugs PHQ + GTIN data)
2. Expiry After Opening rules
3. GTIN Viewer (read-only table, reload from Access DB)

## Settings page
- All font sizes, padding, font family
- Barcode Decoder Method: GS1 AI Parser (default) | Legacy P0-P6

## Known patterns / gotchas
- GitHub Actions only triggers on path changes in `src/**`, `src-tauri/src/**`,
  `Cargo.toml/Lock`, `tauri.conf.json`, `package*.json`, `vite.config.js`
- Binary merge conflicts (`release/*.exe`, `release/*.msi`) happen when merging
  main into feature branch; resolve with `git checkout --ours` (keep branch version)
- `[skip ci]` anywhere in a squash-merge commit body will suppress the build trigger
