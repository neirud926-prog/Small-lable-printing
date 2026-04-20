# Session Handoff — NLTH RxStation Design Migration

_Session date: 2026-04-20_

This session migrated the UI from the legacy Google-blue card-home layout to the new
**NLTH RxStation Design System** (persistent left rail + warm Pharmacy Sage palette).
Source of truth for the design: the Claude Design bundle at
`https://api.anthropic.com/v1/design/h/fiV7EQc38mbsz35FaYHcuQ`.

---

## Where to pick up on the other PC

```bash
# 1. Clone / pull latest
git fetch origin
git checkout main       # or your feature branch
git pull

# 2. Install deps (node_modules is NOT committed)
npm install

# 3. Run dev server (browser-only; print/GTIN-lookup won't work without Tauri)
npm run dev             # → http://localhost:5173

# Optional: full Tauri desktop dev (needs Rust toolchain)
npm run tauri:dev
```

**Important (per `CLAUDE.md`):** feature work should live on branch
`claude/tauri-remote-build-IdhJ7`, then PR to `main`. CI builds the
`release/SmallLabelPrinting.exe` after the PR squash-merges. The design-migration
commits from this session currently sit on whichever branch is checked out —
confirm before pushing.

---

## What was implemented

### Design tokens ([`src/styles/global.css`](src/styles/global.css))
- Replaced `#1a73e8` (Google blue) with **Pale Pharmacy Sage `#8AA380`** + full 50–800 ramp.
- Warm-linen background `#F6F5F2`, warm-grey neutral ramp, desaturated semantic colors.
- Added `--rail-w: 240px`, `--topbar-h: 52px`, `--ring`, `--shadow-sm/lg`, etc.
- New utility classes: `.app-layout`, `.rail`, `.rail-item`, `.topbar`, `.crumb`,
  `.topbar-search`, `.chip`, `.icon-btn`, `.view`, `.ds-card`, `.ds-divider`.

### New components
| File | Purpose |
|---|---|
| [`src/components/AppShell.jsx`](src/components/AppShell.jsx) | Persistent sidebar + top bar + content wrapper. Default nav order: **Drug Enquiry → Small Label Print → Reconstitution → EV54 Tools → Maintenance → Settings**. |
| [`src/components/DrugEnquiry.jsx`](src/components/DrugEnquiry.jsx) | New landing page — real drug list pulled from `getDrugs()` / `getGtinMap()` / `getItemLocation()` / `getExpAfterOpenDays()`. Read-only table with live search. |
| [`src/components/Icon.jsx`](src/components/Icon.jsx) | Inline-SVG Lucide icon component (no CDN, single-file-build safe). ~30 icons registered — add more in the `P` map as needed. |

### Rewires
- [`src/App.jsx`](src/App.jsx) — initial `view` is now `'enquiry'`. Switches views inside `<AppShell>` instead of full-page swap. Top banner styling (silent-print + remote-change) toned down to inline sage/neutral.
- [`src/components/SmallLabelPrint.jsx`](src/components/SmallLabelPrint.jsx) — stripped `.page-header` + back-arrow + `<h1>` (shell now provides crumb/title). Tabs unchanged.
- [`src/components/Settings.jsx`](src/components/Settings.jsx) — stripped header; 5 data-source paths already existed (PHQ / Item Location / Mobile Shelf / EV54 Drugs / GTIN) — no change to their logic.
- [`src/components/Reconstitution/index.jsx`](src/components/Reconstitution/index.jsx) — function renamed `Reconciliation → Reconstitution`, emoji removed from tabs, header stripped.
- [`src/components/EV54Tools/index.jsx`](src/components/EV54Tools/index.jsx) — header stripped, emoji removed from tab labels.
- [`src/components/Maintenance/index.jsx`](src/components/Maintenance/index.jsx) — **replaced 2-row emoji tab strip with a 220px left sub-rail** (grouped Products / Data / Batches / Rules). PIN lock-screen redesigned with sage-themed Lucide lock icon. Functionality unchanged.
- [`src/components/Maintenance/ExpAfterOpen.jsx`](src/components/Maintenance/ExpAfterOpen.jsx) — stripped inner page-header (was rendering a nested back button inside the Maintenance panel).

### Asset + folder moves
- `logo/logo.jpg` → copied to `src/assets/logo-nlth.jpg` so Vite inlines it. Referenced by `AppShell.jsx` brand mark.
- **`src/components/Reconciliation/` folder → renamed to `Reconstitution/`** via `git mv` (history preserved). Children `AbxTab.jsx` / `ExtempTab.jsx` / `PrepackTab.jsx` / `index.jsx` untouched aside from the top-level rename.
- Deleted dead `src/components/MainMenu.jsx` (old card-home; replaced by `DrugEnquiry`).

### Copy changes
- Every user-facing **"Reconciliation" → "Reconstitution"** (incl. empty-state text in `Maintenance/ExpiryRules.jsx`).
- Emoji removed from all navigation chrome and tab labels (design calls for stroke icons only).

---

## Buttons / UI that are NOT yet wired up

These render but have no behavior — flagged in the previous summary, still open:

1. **Top-bar global search** ([`AppShell.jsx`](src/components/AppShell.jsx)) — accepts input, has an `onGlobalSearch` prop but `App.jsx` doesn't pass a handler yet. Intended behavior: Enter → navigate to Drug Enquiry pre-filtered.
2. **⌘K / F1 / F2 / F3 shortcut labels** on nav badges — visual only, no key listener registered.
3. **IP/OP chip** in top bar — static display, not a picker (the real location toggle lives on the Settings page).
4. **Sidebar user-footer block** — decorative "RxStation / Pharmacy workstation". No click action.
5. **Top-bar printer + refresh icons from the design mockup** — deliberately not rendered; the real app has no "refresh now" global action (that belongs on Settings). Add later if desired.

---

## Intentionally not implemented (design stubs)

From the design chat transcript, these were explicitly stubbed in the prototype:
- "Today's batches" feed on Small Label Print (the user asked for it to be removed anyway).
- Printer-status card on Small Label Print (real app has no printer-status telemetry).
- Animated "Listening / Printed" dot on the scan input.
- Mock data tables for Reconstitution batches + EV54 pick list (real app uses real data).

The existing real implementations were left intact so nothing regressed functionally.

---

## Known gotchas

- **Node version**: project's local `vite@5.4.21` works on Node 20.11. Do **not** run `npx vite` bare — it pulls `vite@8` globally, which needs Node 20.19+. Always use `npm run dev`.
- **Single-file build**: `vite-plugin-singlefile` is active and `assetsInlineLimit: 100000000` in `vite.config.js` — everything (including `logo-nlth.jpg`) gets base64-inlined into one HTML. Keep asset additions mindful of bundle size.
- **CI trigger paths** (from `CLAUDE.md`): `src/**`, `src-tauri/src/**`, `Cargo.toml/Lock`, `tauri.conf.json`, `package*.json`, `vite.config.js`. The design changes all live under `src/**` — CI will fire on merge.
- **Binary merge conflicts**: if merging `main` into a feature branch and `release/*.exe` conflicts, resolve with `git checkout --ours`.
- **Decorative `navigate` prop** on `SmallLabelPrint`, `EV54Tools`, `Reconstitution` — `App.jsx` still passes `navigate={navigate}` but the components no longer use it. Harmless; prop can be removed in a cleanup pass.

---

## Unstaged changes at end of session

```
 M small-label-backup.json        ← unclear; review before committing
 M src/App.jsx
 M src/components/EV54Tools/index.jsx
 D src/components/MainMenu.jsx
 M src/components/Maintenance/ExpAfterOpen.jsx
 M src/components/Maintenance/ExpiryRules.jsx
 M src/components/Maintenance/index.jsx
 M src/components/Settings.jsx
 M src/components/SmallLabelPrint.jsx
 M src/styles/global.css
R  src/components/Reconciliation/{AbxTab,ExtempTab,PrepackTab,index}.jsx → Reconstitution/
?? logo/
?? src/assets/
?? src/components/AppShell.jsx
?? src/components/DrugEnquiry.jsx
?? src/components/Icon.jsx
```

Nothing has been committed. Suggested commit message when ready:

```
feat(ui): migrate to NLTH design system — sage palette + left-rail shell

- Replace card-home with persistent Sidebar/TopBar (AppShell)
- Drug Enquiry is the new default landing page
- Calming Neutrals tokens in global.css (Pale Sage #8AA380 + warm ramp)
- Rename Reconciliation → Reconstitution (copy + folder)
- Strip emoji from nav chrome; replace with Lucide SVGs (Icon.jsx)
- Maintenance: left sub-rail replaces 2-row tab strip
- Remove dead MainMenu.jsx
```

---

## Next session suggestions

1. Wire up top-bar global search → Drug Enquiry filter.
2. Register global keydown listener for ⌘K / F1 / F2 / F3.
3. Confirm with user whether top-bar should show real printer status + refresh-now (currently hidden).
4. Review `small-label-backup.json` modification — unclear whether it was touched intentionally.
5. Push + open PR to `main` via `claude/tauri-remote-build-IdhJ7` once user approves the visual result in dev.
