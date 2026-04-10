# Quick Start Guide

## What's New ✨

### 1️⃣ **PHQ Database Path** (Settings)
Store your PHQ database network path or local location.

### 2️⃣ **Excel Importer** (Maintenance → 📊 Import Excel)
Import your Excel data directly into the app:
- Drugs (PHQ)
- Expiry Rules  
- ABX
- And more...

### 3️⃣ **JSON Backup Ready** 
File: `small-label-backup.json` - Ready to import instantly!

---

## 30-Second Setup

### The Instant Way (Recommended)
```
1. Open App
2. Settings → 💾 Data Backup & Restore
3. Click ⬆ Import Backup
4. Select: small-label-backup.json
5. Click Refresh
✓ Done! 14,004 drugs + 57 rules + 19 ABX imported
```

### The Manual Way
```
1. Maintenance → 📊 Import Excel
2. Select data type (e.g., Drugs)
3. Upload your .xlsx file
4. Review preview
5. Click ✓ Merge or ⚠️ Replace All
```

---

## File Locations

| File | Size | Purpose |
|------|------|---------|
| `small-label-backup.json` | 2.5 MB | Complete database backup - import in Settings |
| `SETUP_GUIDE.md` | - | Detailed setup instructions |
| `IMPLEMENTATION_SUMMARY.md` | - | Technical details of what was added |
| `src/utils/excelImporter.js` | - | Excel parsing utility (auto-loads SheetJS) |
| `src/components/Maintenance/ExcelImporter.jsx` | - | Import UI component |

---

## What You Can Do Now

✅ **Set PHQ database path** in Settings  
✅ **Import all 14,004 drugs** from Excel in 2 minutes  
✅ **Import 57 expiry rules** with shelf life & storage info  
✅ **Import 19 ABX items** with prefixes  
✅ **Backup entire database** as JSON file  
✅ **Restore on another PC** using same JSON file  
✅ **Merge or replace** data when importing  
✅ **Preview before import** to catch errors  

---

## Common Tasks

### Import from your Excel file
```
Maintenance → Import Excel → Select type → Choose file → Import
```

### Backup your database
```
Settings → Data Backup & Restore → Export Backup → Download JSON
```

### Restore backup on new PC
```
Settings → Data Backup & Restore → Import Backup → Select JSON → Refresh
```

### Change PHQ database path
```
Settings → PHQ Database Path → Enter path → Save
```

---

## FAQ

**Q: Do I need to install anything?**  
A: No! Excel library loads automatically from CDN.

**Q: What if I have the wrong columns in my Excel?**  
A: The importer shows a preview - you can cancel if data looks wrong.

**Q: Can I import part of the Excel?**  
A: Yes! Import each data type separately (Drugs, Rules, ABX, etc.)

**Q: How do I move setup to another computer?**  
A: Export backup JSON → transfer file → import on new PC.

**Q: Is the 14,004 drug count correct?**  
A: Yes! Extracted from your PHQ sheet - all items with proper codes.

**Q: How big is the backup file?**  
A: 2.5 MB - but it's just text JSON, compresses easily.

---

## Next Steps

1. **Try the backup import** (fastest way to populate database)
2. **Set PHQ database path** if you have one
3. **Customize expiry rules** in Maintenance tab if needed
4. **Test label printing** to verify data loaded correctly

---

## Need Help?

See:
- `SETUP_GUIDE.md` - Detailed step-by-step guide
- `IMPLEMENTATION_SUMMARY.md` - Technical architecture
- Settings page - Auto-print setup instructions

---

**Version:** 1.0  
**Date:** April 10, 2026  
**Status:** ✅ Ready for production
