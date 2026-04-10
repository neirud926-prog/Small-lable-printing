# Small Label Printing App - Setup Guide

## New Features

### 1. PHQ Database Path Setting
**Location:** Settings → ⚙️ General → "PHQ Database Path"

- Store the network or local path to your PHQ database (e.g., `\\server\path\to\database.mdb`)
- This setting is preserved and can be used for future PHQ integration
- Optional field - leave blank if not needed

### 2. Excel Import for Database Setup
**Location:** Maintenance → 📊 Import Excel

The import tool allows you to populate your app database with data from Excel files. You can import:

#### Supported Data Types:
- **💊 Drugs (PHQ)** - Products with item code, name, unit, special flag
- **📅 Expiry Rules** - Shelf life information, storage conditions, warnings
- **⚕️ ABX** - Antibiotic products with prefixes and descriptions  
- **📦 Prepack** - Prepackaged items
- **⚗️ Extemp** - Extemporaneous preparations
- **⏰ Exp After Open** - Expiration time after opening

#### How to Import:

1. **Prepare your Excel file**
   - Create an Excel file (.xlsx) with the correct columns for your data type
   - See expected columns below

2. **Select data type**
   - Click the data type button (e.g., "Drugs (PHQ)")

3. **Choose file**
   - Click the file input area and select your Excel file

4. **Preview & Import**
   - Review the preview of extracted data
   - Choose to **Merge** with existing data or **Replace All**
   - Click the appropriate button to import

#### Expected Columns by Data Type:

**Drugs (PHQ):**
```
itemCode | name | unit | isSpecial
```

**Expiry Rules:**
```
itemCode | manufacturer | shelfLifeValue | shelfLifeUnit | storage | warning | status | note
```

**ABX:**
```
itemCode | prefix | packSize | description
```

**Prepack:**
```
drugCode | prefix | description | unit
```

**Extemp:**
```
itemCode | prefix | volume | description
```

**Exp After Open:**
```
itemCode | days
```

---

## JSON Backup File

A complete backup has been generated from your existing Excel file:
**Location:** `small-label-backup.json` (2.5 MB)

### Contents:
- **14,004 drugs/products** from PHQ sheet
- **57 expiry rules** from ExpiryDate sheet
- **19 ABX entries** from Abx sheet
- Default settings (location, printer name, PIN, etc.)

### How to Use the Backup:

1. **Import in Settings**
   - Go to Settings → 💾 Data Backup & Restore
   - Click "⬆ Import Backup"
   - Select `small-label-backup.json`
   - Click "Refresh the page" after import completes

2. **Restore on Another Computer**
   - Export backup from original PC (Settings → ⬇ Export Backup)
   - Transfer the JSON file to the new PC
   - Import using Settings → ⬆ Import Backup

3. **Share Configuration**
   - Use the JSON file to share identical database setup across multiple PCs

---

## Step-by-Step: Importing from Your Excel File

### Option 1: Use the Pre-Generated Backup (Easiest)
```
1. Open app → Settings
2. Scroll to "💾 Data Backup & Restore"
3. Click "⬆ Import Backup"
4. Select: small-label-backup.json
5. Refresh page
```

### Option 2: Import Piece by Piece
```
1. Open app → Maintenance (unlock with PIN)
2. Click "📊 Import Excel" tab
3. Select data type (e.g., "Drugs (PHQ)")
4. Upload your Excel file
5. Review preview
6. Click "✓ Merge with Existing" or "⚠️ Replace All"
```

### Option 3: Custom Excel Import
If your data is in a different format:
1. Create/export Excel file with correct column names
2. Use the Import Excel tool with matching column headers
3. The tool will extract and import the data

---

## Troubleshooting

### Import says "Excel parsing library not available"
- The app needs the browser to load SheetJS library from CDN
- Ensure you have internet connection, or
- Check if the CDN is accessible: https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js

### Data import doesn't show all records
- Check the preview before importing
- Ensure the first row contains column headers
- Verify column names match expected format (case-insensitive)

### Column names not matching
- The importer is case-insensitive for column matching
- Common alternatives are recognized:
  - "Item Code" = "itemCode" = "Item_Code"
  - "Description" = "name"
  - "Shelf Life Value" = "shelfLifeValue"
  - etc.

### Backup file is very large
- `small-label-backup.json` is 2.5 MB because it contains 14,000+ drug records
- It's safe to import - the app handles large datasets
- Compression is applied during backup export if needed

---

## Files Created

1. **small-label-backup.json** - Full database backup from Excel
2. **src/utils/excelImporter.js** - Excel parsing utility
3. **src/components/Maintenance/ExcelImporter.jsx** - Import UI component
4. **extract_excel_data.py** - Python script to generate backup (for reference)
5. **inspect_sheets.py** - Sheet inspection script (for debugging)

---

## Updated Files

1. **src/utils/storage.js** - Added `phqDatabasePath` to settings
2. **src/components/Settings.jsx** - Added PHQ Database Path input field
3. **src/components/Maintenance/index.jsx** - Added Import Excel tab

---

## Next Steps

- Import the backup or your custom Excel files
- Configure the PHQ database path in Settings
- The app is ready for production use!

For questions or issues, check the app's Settings page for the Chrome Auto-Print Setup Guide.
