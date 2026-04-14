# Small Label Printing — Release Binaries

## Which file do I use?

| File | Use when |
|---|---|
| `Small Label Printing_0.1.0_x64_en-US.msi` | **First-time install** on a new PC. Double-click to install; creates a Start-menu entry. |
| `SmallLabelPrinting.exe` | **Portable run** — just double-click, no install required. |

## Data file

On first launch the app creates `D:\SmallLabel\small-label-data.json`. Every change is auto-saved there. To move settings/data to another PC, copy that single file.

## Configure data sources

Open the app → **Settings → Data Sources** → browse to:

- **PHQ drug list** (.txt)
- **Item Location** (.xls)
- **GTIN database** (.accdb)

Then click **Refresh Now**. These paths are remembered across launches.
