# Small Label Printing — User Acceptance Test

Pharmacy workstation checklist. Run the suite on a clean build of `SmallLabelPrinting.exe`
against the production data file `D:\SmallLabel\small-label-data.json`.

Legend: **☐ Pass** · **☐ Fail**. Add notes in the Notes column when a case fails.

---

## 1. App Startup & Data Connection

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 1.1 | Auto-connect (Tauri) | Launch the app | Loading splash briefly, then Drug Enquiry page appears. Settings → Data connection status shows "💾 Auto-save Active". | ☐ / ☐ |  |
| 1.2 | Refresh Now | Settings → Data Sources → click "🔄 Refresh Now" | Message shows `✓ Refreshed: PHQ drugs, Locations, …` for every configured path. | ☐ / ☐ |  |
| 1.3 | Data paths persist | Change a path, close app, relaunch | Path is retained. | ☐ / ☐ |  |

## 2. Navigation Shell

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 2.1 | Sidebar nav | Click each rail item | Correct view renders; breadcrumb + title match. | ☐ / ☐ |  |
| 2.2 | Default landing | Launch app | Drug Enquiry shown by default. | ☐ / ☐ |  |
| 2.3 | Brand mark | Inspect top of sidebar | NLTH logo and "RxStation · NLTH" label render. | ☐ / ☐ |  |

## 3. Drug Enquiry (default page)

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 3.1 | Drug list loads | Open Drug Enquiry | Table shows item code, name, unit, location, GTIN, exp-after-opening. Count "X of Y drugs" matches imported data. | ☐ / ☐ |  |
| 3.2 | Search by name | Type part of a drug name | Filtered list narrows to matches (max 200 rows). | ☐ / ☐ |  |
| 3.3 | Search by item code | Type a 6-char code | Matching row appears. | ☐ / ☐ |  |
| 3.4 | Search by GTIN | Paste a known GTIN | Matching row appears. | ☐ / ☐ |  |

## 4. Small Label Print

### 4a. Standard tab

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 4.1 | 6-char item code | Type a valid code, Enter | OP label prints (batch + sign; no expiry). | ☐ / ☐ |  |
| 4.2 | GTIN barcode (IP) | Scan a GTIN barcode, select IP | Label shows batch + expiry from the barcode. | ☐ / ☐ |  |
| 4.3 | GTIN barcode (OP) | Scan a GTIN, select OP | Label shows batch only (expiry blank). | ☐ / ☐ |  |
| 4.4 | Manual expiry | In IP flow, clear expiry and enter `DDMMYYYY` | Auto-formats to `DD-Mon-YYYY` and prints. | ☐ / ☐ |  |
| 4.5 | 13-char IP barcode | Scan a 13-char barcode (item code chars 5–10) | IP label prints with the parsed item code. | ☐ / ☐ |  |

### 4b. Short-Exp tab

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 4.6 | Short-exp flow | Enter code with exp-after-open rule | Label prints with the calculated expiry date. | ☐ / ☐ |  |

## 5. Reconstitution

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 5.1 | ABX Preparation | Select ABX tab, generate a label | Label prints with ABX content. | ☐ / ☐ |  |
| 5.2 | Extemporaneous | Select Extemp tab, generate a label | Label prints. | ☐ / ☐ |  |
| 5.3 | Prepack | Select Prepack tab, generate a label | Label prints. | ☐ / ☐ |  |

## 6. EV54 Tools

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 6.1 | Pick list — add item | Print Pick List tab → enter item code → Add | Row appears with mobile-shelf or item-location bin. | ☐ / ☐ |  |
| 6.2 | Pick list — print | Click Print | Pick list prints to default printer. | ☐ / ☐ |  |
| 6.3 | GTIN label — lookup | Print GTIN Label tab → enter 6-char code | Preview shows drug name, item code, GTIN. | ☐ / ☐ |  |
| 6.4 | GTIN label — print (auto size) | Default settings (QR 0 mm, font 5 pt) → Print | QR fills the label, item code reads cleanly below. | ☐ / ☐ |  |
| 6.5 | GTIN label — fixed size | Settings → GTIN QR size 15 mm, font 7 pt → return to GTIN Label → Print | QR is ~15 mm square, item code is larger. | ☐ / ☐ |  |
| 6.6 | GTIN label — quantity | Set quantity 3 → Print | 3 labels print. | ☐ / ☐ |  |

## 7. Maintenance

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 7.1 | PIN lock | Open Maintenance | PIN prompt shown; wrong PIN shakes + errors; correct PIN unlocks. | ☐ / ☐ |  |
| 7.2 | Products group | Open Products / Expiry rules / Exp after open | Each sub-tab renders its editor. | ☐ / ☐ |  |
| 7.3 | Data group | Import Excel / Mobile shelf / EV54 drugs / GTIN database | Each viewer loads. GTIN viewer reloads from Access DB on demand. | ☐ / ☐ |  |
| 7.4 | Batches group | Batch history / Cancel batch | Tables render; cancel marks a batch as Cancelled. | ☐ / ☐ |  |
| 7.5 | Rules group | EV54 allowlist | Rule editor renders. | ☐ / ☐ |  |

## 8. Settings — General

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 8.1 | PIN lock | Open Settings | PIN prompt shown; `NLTH` unlocks. | ☐ / ☐ |  |
| 8.2 | Data Sources | Change each path, browse via Tauri dialog | Path saves immediately. | ☐ / ☐ |  |
| 8.3 | Printer picker | Check Thermal Printer dropdown (Tauri) | Installed printers listed; selection persists. | ☐ / ☐ |  |
| 8.4 | Silent print toggle | Tick Silent print | Next label prints without dialog. | ☐ / ☐ |  |
| 8.5 | Barcode decoder | Toggle GS1 / Legacy | Scanning a GTIN uses the selected parser. | ☐ / ☐ |  |
| 8.6 | Label dimensions | Change width/height, save, print | Label output reflects new size. | ☐ / ☐ |  |
| 8.7 | GTIN QR settings | Change `QR size (mm)` and `Item code font (pt)` → Save | Values persist across app restart and affect GTIN label print. | ☐ / ☐ |  |
| 8.8 | Change Maintenance PIN | Enter current + new PIN → Change | New PIN required on next Settings/Maintenance unlock. | ☐ / ☐ |  |
| 8.9 | Export backup | Click ⬇ Export | JSON file downloads with all data. | ☐ / ☐ |  |
| 8.10 | Import backup | Click ⬆ Import, choose backup file | `✓ Data imported` shown; reload restores data. | ☐ / ☐ |  |

## 9. Settings — Admin

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 9.1 | Admin PIN lock | Settings → Admin tab | Admin PIN prompt shown; wrong PIN shakes; `nlthadmin` unlocks. | ☐ / ☐ |  |
| 9.2 | Disable Small Label Print | Uncheck Small Label Print | Sidebar hides Small Label Print; if current view, redirects to Drug Enquiry. | ☐ / ☐ |  |
| 9.3 | Disable Reconstitution | Uncheck Reconstitution | Sidebar hides Reconstitution. | ☐ / ☐ |  |
| 9.4 | Disable EV54 Tools | Uncheck EV54 Tools | Sidebar hides EV54 Tools. | ☐ / ☐ |  |
| 9.5 | Disable ABX tab | Uncheck ABX Preparation | Reconstitution no longer shows the ABX tab; active tab falls back to first remaining. | ☐ / ☐ |  |
| 9.6 | Disable Extemp tab | Uncheck Extemporaneous | Tab hidden. | ☐ / ☐ |  |
| 9.7 | Disable Prepack tab | Uncheck Prepack | Tab hidden. | ☐ / ☐ |  |
| 9.8 | Disable Pick List | Uncheck Print Pick List | EV54 Tools hides Pick List tab. | ☐ / ☐ |  |
| 9.9 | Disable GTIN Label | Uncheck Print GTIN Label | EV54 Tools hides GTIN Label tab. | ☐ / ☐ |  |
| 9.10 | Re-enable | Re-check any flag | Feature reappears immediately on next navigation. | ☐ / ☐ |  |
| 9.11 | All tabs off | Disable all Reconstitution tabs | Reconstitution page shows "All tabs are disabled" message. | ☐ / ☐ |  |

## 10. Data Backup & Restore Round-trip

| # | Feature | Steps | Expected | Pass / Fail | Notes |
|---|---------|-------|----------|-------------|-------|
| 10.1 | Full round-trip | Export from PC A → install on PC B → Import | PC B shows identical drug list, rules, settings, batches. | ☐ / ☐ |  |

---

**Tester:** ______________________ **Date:** ____________ **Build version:** ____________
