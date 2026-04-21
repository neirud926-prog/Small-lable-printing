# RxStation — User Acceptance Test (UAT)

**App:** RxStation · NLTH  
**Version:** as built  
**Tester:** _______________  **Date:** _______________  **Build:** _______________

> **Instructions:** Work through each section in order. Mark each row **Pass ✓** or **Fail ✗** and add notes where relevant.  
> Prerequisites: app installed, `small-label-data.json` present, thermal printer connected, drug data imported.

---

## 1. App Startup & Data Connection

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 1.1 | Tauri auto-save path | Launch app | Loading splash shown briefly; app opens directly to Drug Enquiry without a file-picker prompt | ☐ Pass ☐ Fail | |
| 1.2 | Data persistence | Enter any setting value, close and reopen app | Value is still present after reopen | ☐ Pass ☐ Fail | |
| 1.3 | Auto-load on startup | Configure at least one data path in Settings; restart app | Status bar / refresh result shows data loaded silently | ☐ Pass ☐ Fail | |
| 1.4 | Data file path shown | Open Settings → General → Data connection card | Shows "Auto-save Active" with correct file path | ☐ Pass ☐ Fail | |

---

## 2. Navigation & Main Menu

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 2.1 | Left-rail navigation | Click each item in the left rail | Correct page loads with correct title and subtitle | ☐ Pass ☐ Fail | |
| 2.2 | Keyboard shortcut F1 | Press F1 | Small Label Print page opens | ☐ Pass ☐ Fail | |
| 2.3 | Keyboard shortcut F2 | Press F2 | Reconstitution page opens | ☐ Pass ☐ Fail | |
| 2.4 | Keyboard shortcut F3 | Press F3 | EV54 Tools page opens | ☐ Pass ☐ Fail | |
| 2.5 | Active nav highlight | Navigate to each page | Corresponding rail item shows active style | ☐ Pass ☐ Fail | |
| 2.6 | Feature flag — hide page | Settings → Admin (pin: `nlthadmin`) → uncheck **Small Label Print** → navigate away | "Small Label Print" item no longer visible in left rail | ☐ Pass ☐ Fail | |
| 2.7 | Feature flag — restore page | Re-check **Small Label Print** → navigate away and back | Item reappears in left rail | ☐ Pass ☐ Fail | |

---

## 3. Drug Enquiry

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 3.1 | Search by item code | Type a known 6-char item code | Drug details card shown: name, manufacturer, expiry rules | ☐ Pass ☐ Fail | |
| 3.2 | Search by name | Type partial drug name | Matching drugs listed | ☐ Pass ☐ Fail | |
| 3.3 | Unknown code | Type an unknown code | "Not found" message shown; no crash | ☐ Pass ☐ Fail | |
| 3.4 | Read-only | Verify no print button is present | Only lookup; no print action available | ☐ Pass ☐ Fail | |

---

## 4. Small Label Print

### 4a — Standard Tab

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 4.1 | 6-char manual entry | Type a known item code (6 chars) + Enter | OP label preview shown with drug name; batch fields blank | ☐ Pass ☐ Fail | |
| 4.2 | GS1 barcode scan | Scan a GS1-128 / DataMatrix drug box | IP/OP modal shown; item code, batch, expiry populated from AI fields | ☐ Pass ☐ Fail | |
| 4.3 | IP label | In IP/OP modal select **IP** → confirm | Label preview shows drug name, batch no., and expiry date | ☐ Pass ☐ Fail | |
| 4.4 | OP label | In IP/OP modal select **OP** → confirm | Label preview shows drug name and batch no.; expiry field is blank | ☐ Pass ☐ Fail | |
| 4.5 | Expiry edit | Scan a barcode with no expiry; in IP mode type `01062025` | Expiry auto-formats to `01-Jun-2025` | ☐ Pass ☐ Fail | |
| 4.6 | Silent print | Settings → enable Silent Print → scan barcode → confirm | Label prints directly with no OS print dialog | ☐ Pass ☐ Fail | |
| 4.7 | Print dialog | Settings → disable Silent Print → confirm | OS print dialog shown before printing | ☐ Pass ☐ Fail | |
| 4.8 | Batch counter increments | Print a label → check Maintenance → Batch Counters | Counter for the active location incremented by 1 | ☐ Pass ☐ Fail | |
| 4.9 | Unknown GTIN | Scan a barcode with a GTIN not in the GTIN map | Error message shown: "GTIN not found" | ☐ Pass ☐ Fail | |

### 4b — Short Expiry Tab

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 4.10 | Short exp label | Switch to Short Exp tab; enter item code with a near-expiry drug | Label generated with short-expiry format | ☐ Pass ☐ Fail | |

---

## 5. Reconstitution

### 5a — ABX Preparation Tab

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 5.1 | Select antibiotic | Choose an ABX drug from the list | Reconstitution details shown (volume, diluent, concentration) | ☐ Pass ☐ Fail | |
| 5.2 | Generate label | Fill required fields → Print | ABX preparation label printed | ☐ Pass ☐ Fail | |
| 5.3 | Disable ABX tab | Settings → Admin → uncheck **ABX Preparation** → go to Reconstitution | ABX tab no longer shown; first remaining tab is active | ☐ Pass ☐ Fail | |
| 5.4 | Re-enable ABX tab | Re-check **ABX Preparation** | Tab reappears on next navigation to Reconstitution | ☐ Pass ☐ Fail | |

### 5b — Extemporaneous Tab

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 5.5 | Generate extemp label | Select extemp preparation → fill fields → Print | Extemp label printed with correct details | ☐ Pass ☐ Fail | |
| 5.6 | Disable Extemp tab | Settings → Admin → uncheck **Extemporaneous** | Tab hidden from Reconstitution | ☐ Pass ☐ Fail | |

### 5c — Prepack Tab

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 5.7 | Generate prepack label | Select prepack item → fill quantity → Print | Prepack label printed | ☐ Pass ☐ Fail | |
| 5.8 | Disable Prepack tab | Settings → Admin → uncheck **Prepack** | Tab hidden from Reconstitution | ☐ Pass ☐ Fail | |

---

## 6. EV54 Tools

### 6a — Print EV54 Pick List Tab

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 6.1 | Add item by code | Type a known item code in the pick list input + Enter | Item row added with drug name, shelf location, mobile shelf bin | ☐ Pass ☐ Fail | |
| 6.2 | Shelf location shown | Add item that has a location in Item Location data | "Location" column shows correct shelf location | ☐ Pass ☐ Fail | |
| 6.3 | Mobile shelf bin shown | Add item that has a mobile shelf entry | "Mobile Shelf" column shows correct bin | ☐ Pass ☐ Fail | |
| 6.4 | Remove item | Click the remove button on a row | Row removed from pick list | ☐ Pass ☐ Fail | |
| 6.5 | Print pick list | Add several items → click Print Pick List | List printed to thermal printer; items cleared after print | ☐ Pass ☐ Fail | |
| 6.6 | EV54 restrict mode | Settings → enable Restrict to EV54 List → enter a code not in EV54 Drugs | Error "not in EV54 list"; item rejected | ☐ Pass ☐ Fail | |
| 6.7 | Disable Pick List tab | Settings → Admin → uncheck **Print Pick List** → go to EV54 Tools | Pick List tab not shown; GTIN Label tab active | ☐ Pass ☐ Fail | |

### 6b — Print GTIN Label Tab

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 6.8 | Code lookup | Type a known 6-char item code | Drug name and GTIN shown in preview | ☐ Pass ☐ Fail | |
| 6.9 | Unknown code | Type an unknown item code | Error: "Item code not found" | ☐ Pass ☐ Fail | |
| 6.10 | No GTIN for code | Type a code with no GTIN in the map | Error: "No GTIN found for this item code" | ☐ Pass ☐ Fail | |
| 6.11 | Print QR label | Enter valid code → click Print Label | QR label printed with GTIN QR code and item code text below | ☐ Pass ☐ Fail | |
| 6.12 | Quantity > 1 | Set quantity to 3 → Print | 3 identical labels printed | ☐ Pass ☐ Fail | |
| 6.13 | Custom QR size | Settings → GTIN QR Label → set QR Code Size to 15 mm → Save → print label | QR code occupies 15 mm; item code text below | ☐ Pass ☐ Fail | |
| 6.14 | Custom font size | Settings → GTIN QR Label → set Item Code Font Size to 8pt → Save → print label | Item code text is visibly larger | ☐ Pass ☐ Fail | |
| 6.15 | Auto QR size (0) | Settings → set QR Code Size to 0 → Save → print label | QR code fills label height automatically | ☐ Pass ☐ Fail | |
| 6.16 | Disable GTIN Label tab | Settings → Admin → uncheck **Print GTIN Label** → go to EV54 Tools | GTIN Label tab not shown; Pick List tab active | ☐ Pass ☐ Fail | |

---

## 7. Maintenance

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 7.1 | PIN lock | Navigate to Maintenance | PIN prompt shown before any content | ☐ Pass ☐ Fail | |
| 7.2 | Wrong PIN | Enter incorrect PIN | Shake animation + "Incorrect PIN" message; page not unlocked | ☐ Pass ☐ Fail | |
| 7.3 | Correct PIN | Enter `NLTH` (default) | Page unlocks and shows all tabs | ☐ Pass ☐ Fail | |
| 7.4 | Import PHQ drugs | Import tab → browse to PHQ .txt file → Import | Drugs imported; count shown | ☐ Pass ☐ Fail | |
| 7.5 | Import item locations | Import tab → import location .xls | Locations loaded; findable in pick list | ☐ Pass ☐ Fail | |
| 7.6 | Expiry After Open rules | Exp After Open tab → add a rule for an item code with days value | Rule saved; shown in list | ☐ Pass ☐ Fail | |
| 7.7 | GTIN Viewer | GTIN tab → click Reload from Database | Table populated with GTIN → Item Code mappings | ☐ Pass ☐ Fail | |
| 7.8 | Batch history | Batch History tab | Today's in-use batches shown | ☐ Pass ☐ Fail | |

---

## 8. Settings — General

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 8.1 | PIN lock | Navigate to Settings | PIN prompt shown before any content | ☐ Pass ☐ Fail | |
| 8.2 | Wrong PIN | Enter wrong PIN | Shake + "Incorrect PIN"; page not unlocked | ☐ Pass ☐ Fail | |
| 8.3 | Correct PIN | Enter `NLTH` (or current PIN) | Page unlocks; General tab visible by default | ☐ Pass ☐ Fail | |
| 8.4 | Save settings | Change any value → click Save | "✓ Saved" confirmation shown; value persists after page change | ☐ Pass ☐ Fail | |
| 8.5 | Location selector | Change Location to **EC** → Save | Batch counter used is now the EC counter | ☐ Pass ☐ Fail | |
| 8.6 | Printer name | Enter printer name → Save → print label | Label goes to specified printer | ☐ Pass ☐ Fail | |
| 8.7 | Data source paths | Enter a valid PHQ path → Refresh Now | "✓ Refreshed: PHQ drugs" shown | ☐ Pass ☐ Fail | |
| 8.8 | Barcode decoder toggle | Switch to **Legacy (P0–P6)** → Save → scan barcode | Barcode parsed using legacy positional method | ☐ Pass ☐ Fail | |
| 8.9 | Label dimensions | Change Label Width to 40 mm → Save → print | Label width reflects new value | ☐ Pass ☐ Fail | |
| 8.10 | GTIN QR Code Size | Set **QR Code Size** to 18 → Save | Value persists; affects next GTIN label print | ☐ Pass ☐ Fail | |
| 8.11 | GTIN font size | Set **Item Code Font Size** to 7 → Save | Value persists; affects next GTIN label print | ☐ Pass ☐ Fail | |
| 8.12 | Change PIN | Change Maintenance PIN to a new value → log out of Settings → re-enter | New PIN required to unlock | ☐ Pass ☐ Fail | |

---

## 9. Settings — Admin

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 9.1 | Admin tab visible | Settings (unlocked) → click **Admin** tab | Admin tab content shown | ☐ Pass ☐ Fail | |
| 9.2 | Admin PIN prompt | Admin tab shown with a secondary PIN form | "Admin Access" card with PIN input visible | ☐ Pass ☐ Fail | |
| 9.3 | Wrong admin PIN | Enter wrong admin PIN | Shake + "Incorrect PIN" | ☐ Pass ☐ Fail | |
| 9.4 | Correct admin PIN | Enter `nlthadmin` | Three grouped panels shown: Main Menu Pages, Reconstitution Tabs, EV54 Tools Tabs | ☐ Pass ☐ Fail | |
| 9.5 | Disable Small Label Print | Uncheck **Small Label Print** | "Small Label Print" disappears from left rail immediately on next nav | ☐ Pass ☐ Fail | |
| 9.6 | Disable Reconstitution | Uncheck **Reconstitution** | "Reconstitution" disappears from left rail | ☐ Pass ☐ Fail | |
| 9.7 | Disable EV54 Tools | Uncheck **EV54 Tools** | "EV54 Tools" disappears from left rail | ☐ Pass ☐ Fail | |
| 9.8 | Disable ABX tab | Uncheck **ABX Preparation** → navigate to Reconstitution | ABX tab not visible; next enabled tab is active | ☐ Pass ☐ Fail | |
| 9.9 | Disable Extemp tab | Uncheck **Extemporaneous** → navigate to Reconstitution | Extemp tab not visible | ☐ Pass ☐ Fail | |
| 9.10 | Disable Prepack tab | Uncheck **Prepack** → navigate to Reconstitution | Prepack tab not visible | ☐ Pass ☐ Fail | |
| 9.11 | Disable Pick List tab | Uncheck **Print Pick List** → navigate to EV54 Tools | Pick List tab not visible; GTIN Label tab active | ☐ Pass ☐ Fail | |
| 9.12 | Disable GTIN Label tab | Uncheck **Print GTIN Label** → navigate to EV54 Tools | GTIN Label tab not visible; Pick List tab active | ☐ Pass ☐ Fail | |
| 9.13 | Re-enable all | Re-check all boxes | All pages and tabs reappear on next navigation | ☐ Pass ☐ Fail | |
| 9.14 | Persistence across restart | Disable a page → close and reopen app → open Settings → Admin | Disabled state persists | ☐ Pass ☐ Fail | |

---

## 10. Data Backup & Restore

| # | Feature | Steps | Expected Result | Pass / Fail | Notes |
|---|---------|-------|-----------------|-------------|-------|
| 10.1 | Export backup | Settings → General → **Export Backup** | JSON file downloaded with today's date in filename | ☐ Pass ☐ Fail | |
| 10.2 | Backup content | Open exported JSON | Contains keys for drugs, expiry rules, settings, batch records, GTIN map | ☐ Pass ☐ Fail | |
| 10.3 | Import backup | **Import Backup** → select the exported file | "✓ Data imported successfully" message shown | ☐ Pass ☐ Fail | |
| 10.4 | Data integrity after import | Refresh page after import | All previously exported data visible and correct | ☐ Pass ☐ Fail | |
| 10.5 | Invalid file | Import a non-JSON file | "✗ Import failed — invalid file format" shown | ☐ Pass ☐ Fail | |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tester | | | |
| Pharmacist / Reviewer | | | |
| IT / Developer | | | |

**Overall Result:** ☐ PASS — ready for release &nbsp;&nbsp; ☐ FAIL — defects to resolve (see Notes)
