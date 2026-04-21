# Session Handoff — RxStation User Guide

**Branch:** `claude/create-user-guides-oRlGP`
**Plan file:** `/root/.claude/plans/create-user-guide-for-linked-globe.md`
**User's request:** A step-by-step, kid-simple user guide for every page and
function in the RxStation app, output as `doc/RxStation UserGuide.docx`, HK
common English, with mockup screenshots that have red boxes + numbered circles
showing exactly where to click.

---

## Where we are (at handoff time)

### ✅ Done
1. Plan approved by user — see `/root/.claude/plans/create-user-guide-for-linked-globe.md`.
2. Dev tools installed on this sandbox: `pandoc 3.1.3`, `rsvg-convert 2.58`,
   `libreoffice-writer`, `poppler-utils`. If the next session runs on a fresh
   sandbox, reinstall with:
   ```sh
   sudo apt-get install -y pandoc librsvg2-bin libreoffice-writer poppler-utils
   ```
3. `doc/user-guide/` scaffold committed:
   - `build.sh` — one command that renders SVG → PNG, rewrites image paths,
     and runs `pandoc` to produce `doc/RxStation UserGuide.docx`.
   - `RxStation-UserGuide.md` — chapter skeleton with Chapter 4a fully
     written (Small Label Print → Standard Label).
4. **All 17 SVG mockups authored.** The user approved the style after
   reviewing `03-smalllabel-standard.svg`.
   - `01-mainwindow.svg`
   - `02-drugenquiry.svg`
   - `03-smalllabel-standard.svg` ← style reference
   - `04-smalllabel-ipop-modal.svg`
   - `05-smalllabel-shortexp.svg`
   - `06-labelpreview.svg`
   - `07-recon-abx.svg`
   - `08-recon-extemp.svg`
   - `09-recon-prepack.svg`
   - `10-ev54-picklist.svg`
   - `11-ev54-gtinlabel.svg`
   - `12-maint-pingate.svg`
   - `13-maint-sidebar.svg`
   - `14-maint-import-preview.svg`
   - `15-settings-general-top.svg`
   - `16-settings-labeldims.svg`
   - `17-settings-admin.svg`

### ⏳ Not done yet
- **Chapter bodies for Chapters 2, 3, 4b, 5, 6, 7, 8, 9, 10, 11.** Only
  Chapter 4a is written. Every other chapter in `RxStation-UserGuide.md`
  still shows *"(Chapter body to be added after sample approval.)"*.
- Final build + PDF sanity check.
- Final commit + push.

---

## What the next session must do

### 1. Pull the branch
```sh
cd /home/user/Small-lable-printing
git fetch origin claude/create-user-guides-oRlGP
git checkout claude/create-user-guides-oRlGP
```

### 2. Write the remaining 10 chapter bodies
Edit `doc/user-guide/RxStation-UserGuide.md`. Replace each
*"(Chapter body to be added after sample approval.)"* stub with the real
content.

Use **Chapter 4a (already in the file)** as the style template — every chapter
must follow its voice and structure:

- Opens with a 1–2-sentence description of the page's purpose.
- Shows the mockup: `![caption](images/NN-name.svg)`
- Tells the reader "Follow the red numbers on the picture above."
- Each numbered step begins with **① ② ③ ④ ⑤ …** matching the red circles
  in the SVG mockup, in bold.
- Uses HK common English. Short sentences. Active voice ("Click the box.").
  One idea per sentence.
- Keep the emojis that appear in the real UI verbatim (e.g. `🖨 Print Label`,
  `✓ Merge with Existing`, `⚠️ Replace All`).
- End each chapter with a "What if something goes wrong?" bullet list
  quoting the exact on-screen error messages from the code.

**Mockup → chapter mapping** (each mockup's callout count drives how many
① steps to write):

| Chapter | Mockup | # of red callouts |
|---|---|---|
| 2 First Look | `01-mainwindow.svg` | 6 |
| 3 Drug Enquiry | `02-drugenquiry.svg` | 2 |
| 4a Standard | `03-smalllabel-standard.svg` | 4 (done) |
| 4a also uses | `04-smalllabel-ipop-modal.svg` | 2 (for IP/OP modal sub-section) |
| 4a also uses | `06-labelpreview.svg` | 4 (for "what's on the sticker" sub-section) |
| 4b Short Exp | `05-smalllabel-shortexp.svg` | 3 |
| 5a ABX | `07-recon-abx.svg` | 5 |
| 5b Extemp | `08-recon-extemp.svg` | 3 |
| 5c Prepack | `09-recon-prepack.svg` | 5 |
| 6a Pick List | `10-ev54-picklist.svg` | 3 |
| 6b GTIN Label | `11-ev54-gtinlabel.svg` | 2 |
| 7 intro | `12-maint-pingate.svg` | 2 |
| 7 intro also | `13-maint-sidebar.svg` | 4 |
| 7d Import Excel | `14-maint-import-preview.svg` | 4 |
| 8a General | `15-settings-general-top.svg` | 2 |
| 8a Label Dims | `16-settings-labeldims.svg` | 4 |
| 8b Admin | `17-settings-admin.svg` | 4 |
| 9 Everyday Recipes | (none — cross-references earlier chapters) | — |
| 10 Errors | (none) | — |
| 11 Shortcuts | (none) | — |

**Source of truth for button labels and behavior** — do not paraphrase,
quote verbatim:

- `src/components/AppShell.jsx` — nav order, F1/F2/F3, `⌘K`, subtitles, breadcrumbs
- `src/components/DrugEnquiry.jsx` — placeholder: *"Search drug name, item code, or GTIN…"*
- `src/components/SmallLabelPrint.jsx` — tab labels, error strings, modal text
- `src/components/Reconstitution/{AbxTab,ExtempTab,PrepackTab}.jsx`
- `src/components/EV54Tools/{PrintPickList,PrintGtinLabel}.jsx`
- `src/components/Maintenance/*` — especially `ExcelImporter.jsx`
  (`✓ Merge with Existing`, `⚠️ Replace All`), `ProductManager.jsx` (`+ Add`),
  `ExpiryRules.jsx`, `ExpAfterOpen.jsx`, `CancelBatch.jsx`,
  `EV54AllowlistRule.jsx`
- `src/components/Settings.jsx` — all section headings (with emojis),
  field labels, default values, `Save settings`, `⬇ Export Backup`,
  `⬆ Import Backup`, PIN change flow
- `src/utils/storage.js` lines 167–208 — the default values (Width 34.4mm,
  Height 25mm, Arial, Drug 6pt bold, Batch 5pt, Sign 5pt, padding 0 all sides,
  Location `IP/OP`, Printer default `Thermal GX420t - PMS`, Maintenance PIN
  default `NLTH`)
- Admin PIN (hardcoded): `nlthadmin` in `Settings.jsx:13`

**Chapter 7 must tell the reader to change the Maintenance PIN to something
else on first use** (Settings → Change Maintenance PIN).

**Chapter 9 (Everyday Recipes)** — six one-page recipes, each a numbered
list that cross-references the page chapters:
1. Print an OP label (no expiry)
2. Print an IP label from a GTIN scan
3. Print a short-expiry label after opening a vial
4. Import a new drug list from Excel
5. Back up your data (Settings → Data Backup & Restore → Export Backup)
6. Change the thermal printer

**Chapter 10 (When Things Go Wrong)** — one row per error, table form:

| The app says… | It means… | What to do |
|---|---|---|
| Drug not found (XXXXXX)… | The 6-letter code isn't in the drug list. | Ask an admin to import the drug list via Maintenance → Import Excel → Drugs (PHQ). |
| Could not decode barcode | The scanner read the label but the app can't parse it. | Try again slowly. Switch to Legacy decoder in Settings if it keeps failing. |
| Unrecognised input. Enter a 6-char item code or scan a barcode. | What you typed is the wrong length. | Item codes are exactly 6 characters. |
| GTIN not found | The GTIN is not in the GTIN map. | Import the latest GTIN database in Maintenance → GTIN Viewer → Reload from DB. |
| Incorrect PIN. Please try again. | The PIN you typed is wrong. | Default is `NLTH`. If it was changed and you've lost it, ask an admin. |
| No expiry-after-open rule found for this item. | Short-Exp needs a rule that isn't set up yet. | Maintenance → Exp After Open → Add the item. |

(Pull the exact wording from the JSX files when writing — don't invent.)

**Chapter 11 (Keyboard Shortcuts)** — simple table: `F1` Small Label Print,
`F2` Reconstitution, `F3` EV54 Tools, `⌘K` (Cmd+K / Ctrl+K) global search,
`Enter` submit scan in current input.

### 3. Build and sanity-check

```sh
bash doc/user-guide/build.sh
# → rebuilds doc/RxStation UserGuide.docx

# Optional PDF render for eyeball check:
cp "doc/RxStation UserGuide.docx" /tmp/guide.docx
libreoffice --headless -env:UserInstallation=file:///tmp/lo-profile \
    --convert-to pdf --outdir /tmp /tmp/guide.docx
pdftoppm -f 1 -l 99 -r 120 /tmp/guide.pdf /tmp/guidepg -png
# then Read /tmp/guidepg-N.png for any page N
```

Check that:
- TOC at the front has every chapter and sub-chapter.
- Every numbered prose step (① ② ③ …) has a matching red circle of the same
  number on the mockup.
- Every `🖨 Print Label`, `✓ Merge with Existing`, `⚠️ Replace All` etc.
  renders correctly (pandoc sometimes mangles emoji — verify in the PDF).
- No "(Chapter body to be added after sample approval.)" string remains.
- `doc/RxStation UserGuide.docx` is committed (binary; this repo already
  tracks the `.msi` files in `release/` so a `.docx` is fine).

### 4. Commit + push (no PR unless user asks)

```sh
git add doc/
git commit -m "docs: complete RxStation User Guide (all chapters + 17 mockups)"
git push origin claude/create-user-guides-oRlGP
```

---

## Style conventions (don't drift)

**Mockup style** — user approved this after one revision. Keep it identical:
- Windows 11 title bar (min `─`, max `☐`, close `✕` on the right). No macOS
  traffic lights.
- White left rail (`#FFFFFF`), not dark grey/black.
- Warm off-white page background (`#F6F5F2`).
- Sage-green primary (`#8AA380`) for active buttons/tabs; pale green
  (`#F1F5F0`) for active nav row with dark green text (`#4E5B47`).
- Callout red: `#E53935`, 2.2 px stroke, no fill, rounded corners.
- Numbered badge: red circle `#E53935`, white number, 14 px radius, placed
  just outside the target so it doesn't cover UI text.
- Dashed arrow (`stroke-dasharray="6 4"`) only for the very first input on
  each page (to say *"start here"*).

**Writing style** — user approved after Chapter 4a. Keep it:
- HK common English. No American slang. No jargon.
- Short sentences. One idea per sentence. Active voice.
- Keep in-UI emojis verbatim (`🖨`, `✓`, `⚠️`) — they help the user find
  the button on screen.
- No emojis in body prose (only in quoted button labels).
- Pharmacy terms stay as-is: IP, OP, GTIN, batch no., expiry, vial.

**PIN disclosure** — user approved:
- Print `NLTH` (Maintenance PIN default). Tell reader to change it on
  first use.
- Print `nlthadmin` (Admin PIN). Note "only a system admin should know this".

---

## File map

```
doc/
  RxStation UserGuide.docx           ← final output (rebuild via build.sh)
  user-guide/
    RxStation-UserGuide.md           ← edit THIS file
    build.sh                         ← builds the .docx
    images/
      *.svg                          ← 17 source mockups (all done)
      png/*.png                      ← auto-generated by build.sh
```

---

## Quick sanity test before calling it done

Read page 2 of the rendered PDF — it shows Chapter 4a with the
`03-smalllabel-standard.svg` mockup and the numbered ① ② ③ ④ steps.
Everything you add must look and read like that page. If a new chapter
doesn't match that bar, rewrite it.

---

## Known quirks on this sandbox

- `pandoc`'s SVG support for docx is patchy across versions, so `build.sh`
  renders to PNG first. Don't change this.
- `libreoffice --headless` needs `-env:UserInstallation=file:///tmp/lo-profile`
  or it fails with *"source file could not be loaded"*.
- Default `libreoffice` install does NOT include `libreoffice-writer`.
  Install it if PDF conversion errors out.
