/**
 * storage.js — unified data layer
 *
 * Priority:
 *   1. TAURI   (native fs at D:\SmallLabel\small-label-data.json) — default in app
 *   2. FILE    (shared JSON via File System Access API)            — browser fallback
 *   3. LOCAL   (localStorage)                                      — last-resort fallback
 *
 * localStorage is always kept as a write-through backup.
 */

import * as ts from './tauriStorage'
import * as fs from './fileStorage'

// ── Low-level helpers ─────────────────────────────────────────────────────────
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

function load(key, fallback) {
  if (ts.isConnected()) return ts.get(key, lsGet(key, fallback))
  if (fs.isConnected()) return fs.get(key, lsGet(key, fallback))
  return lsGet(key, fallback)
}

function save(key, value) {
  lsSet(key, value)             // always write localStorage as backup
  if (ts.isConnected())      ts.set(key, value)
  else if (fs.isConnected()) fs.set(key, value)
}

// ── Key constants ─────────────────────────────────────────────────────────────
const KEYS = {
  DRUGS:           'sml_drugs',
  EXPIRY_RULES:    'sml_expiryRules',
  ABX:             'sml_abx',
  PREPACK:         'sml_prepack',
  EXTEMP:          'sml_extemp',
  EXP_AFTER_OPEN:  'sml_expAfterOpen',
  BATCH_RECORDS:   'sml_batchRecords',
  BATCH_COUNTERS:  'sml_batchCounters',
  SETTINGS:        'sml_settings',
  ITEM_LOCATIONS:  'sml_itemLocations',   // { itemCode → location string }
  MOBILE_SHELF:    'sml_mobileShelf',     // { itemCode → bin string } (EV54 refill stock)
  EV54_DRUGS:      'sml_ev54Drugs',       // [{ itemCode, name, evLocator }]
  GTIN_MAP:        'sml_gtinMap',         // { gtin → itemCode }
  DATA_PATHS:      'sml_dataPaths',       // { phq, location, mobileShelf, ev54Drugs, gtin, stockOnhand } file paths
  STOCK_ONHAND:    'sml_stockOnhand',     // { ITEMCODE → { lot, expDate, qty, unit } } – longest exp per item
  STOCK_ONHAND_META: 'sml_stockOnhand_meta', // { sourceDate: 'YYYY-MM-DD' | null, refreshedAt: ISO string }
  COMPUTER_PROFILES: 'sml_computerProfiles', // { COMPUTERNAME → { enableSmallLabel, … } }
}

// ── DRUGS ─────────────────────────────────────────────────────────────────────
export function getDrugs()           { return load(KEYS.DRUGS, []) }
export function saveDrugs(list)      { save(KEYS.DRUGS, list) }
export function findDrugByCode(code) {
  return getDrugs().find(d => d.itemCode.toUpperCase() === code.toUpperCase()) || null
}

// ── EXPIRY RULES ──────────────────────────────────────────────────────────────
export function getExpiryRules()      { return load(KEYS.EXPIRY_RULES, []) }
export function saveExpiryRules(list) { save(KEYS.EXPIRY_RULES, list) }
export function getActiveManufacturers(itemCode) {
  return getExpiryRules()
    .filter(r => r.itemCode.toUpperCase() === itemCode.toUpperCase() && r.status === 'Active')
    .map(r => r.manufacturer)
}
export function getExpiryRule(itemCode, manufacturer) {
  return getExpiryRules().find(
    r => r.itemCode.toUpperCase() === itemCode.toUpperCase() &&
         r.manufacturer === manufacturer &&
         r.status === 'Active'
  ) || null
}

// ── ABX ───────────────────────────────────────────────────────────────────────
export function getAbxList()         { return load(KEYS.ABX, []) }
export function saveAbxList(list)    { save(KEYS.ABX, list) }
export function findAbx(itemCode)    {
  return getAbxList().find(a => a.itemCode.toUpperCase() === itemCode.toUpperCase()) || null
}

// ── PREPACK ───────────────────────────────────────────────────────────────────
export function getPrepackList()      { return load(KEYS.PREPACK, []) }
export function savePrepackList(list) { save(KEYS.PREPACK, list) }

// ── EXTEMP ────────────────────────────────────────────────────────────────────
export function getExtempList()       { return load(KEYS.EXTEMP, []) }
export function saveExtempList(list)  { save(KEYS.EXTEMP, list) }

// ── EXP AFTER OPEN ────────────────────────────────────────────────────────────
export function getExpAfterOpen()       { return load(KEYS.EXP_AFTER_OPEN, []) }
export function saveExpAfterOpen(list)  { save(KEYS.EXP_AFTER_OPEN, list) }
export function getExpAfterOpenDays(itemCode) {
  const rec = getExpAfterOpen().find(e => e.itemCode.toUpperCase() === itemCode.toUpperCase())
  return rec ? rec.days : null
}

// ── BATCH RECORDS ─────────────────────────────────────────────────────────────
export function getBatchRecords() { return load(KEYS.BATCH_RECORDS, []) }
export function addBatchRecord(record) {
  const records = getBatchRecords()
  const newRecord = { ...record, id: Date.now().toString() }
  records.unshift(newRecord)
  save(KEYS.BATCH_RECORDS, records)
  return newRecord
}
export function updateBatchStatus(id, status) {
  const records = getBatchRecords()
  const idx = records.findIndex(r => r.id === id)
  if (idx !== -1) {
    records[idx].status = status
    save(KEYS.BATCH_RECORDS, records)
  }
}
export function getTodayInUseBatches() {
  const today = new Date().toLocaleDateString('en-CA')
  return getBatchRecords().filter(r => r.date === today && r.status === 'In Use')
}

// ── BATCH COUNTERS ────────────────────────────────────────────────────────────
export function getBatchCounters()         { return load(KEYS.BATCH_COUNTERS, { EC: 1, IPOP: 1 }) }
export function getCounter(location)       { return getBatchCounters()[location] || 1 }
export function incrementCounter(location) {
  const c = getBatchCounters()
  c[location] = (c[location] || 1) + 1
  save(KEYS.BATCH_COUNTERS, c)
}
export function resetCounter(location, value) {
  const c = getBatchCounters()
  c[location] = parseInt(value, 10) || 1
  save(KEYS.BATCH_COUNTERS, c)
}

// ── ITEM LOCATIONS ────────────────────────────────────────────────────────────
/** Returns { ITEMCODE: 'location string', … } */
export function getItemLocations()      { return load(KEYS.ITEM_LOCATIONS, {}) }
export function saveItemLocations(map)  { save(KEYS.ITEM_LOCATIONS, map) }
export function getItemLocation(code)   {
  return getItemLocations()[code.toUpperCase()] || ''
}

// ── MOBILE SHELF ──────────────────────────────────────────────────────────────
// Bin assignments on the mobile shelf / wooden cabinet used for EV54 refill.
// Same shape as ITEM_LOCATIONS: { ITEMCODE: 'bin string' }
export function getMobileShelf()        { return load(KEYS.MOBILE_SHELF, {}) }
export function saveMobileShelf(map)    { save(KEYS.MOBILE_SHELF, map) }
export function getMobileShelfBin(code) {
  return getMobileShelf()[code.toUpperCase()] || ''
}

// ── EV54 DRUGS ────────────────────────────────────────────────────────────────
// Authoritative list of drugs the EV54 machine stocks.
// Shape: [{ itemCode, name, evLocator }]
export function getEV54Drugs()      { return load(KEYS.EV54_DRUGS, []) }
export function saveEV54Drugs(list) { save(KEYS.EV54_DRUGS, list) }
export function findEV54Drug(code)  {
  return getEV54Drugs().find(d => d.itemCode.toUpperCase() === code.toUpperCase()) || null
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
export function getSettings() {
  return load(KEYS.SETTINGS, {
    location:        'IP/OP',
    printerName:     'Thermal GX420t - PMS',
    maintenancePin:  'NLTH',
    showPrintDialog: true,
    silentPrint:     false,   // Tauri only — bypasses print dialog via Edge kiosk mode
    phqDatabasePath: '',
    // Label dimensions (mm)
    labelWidth:      34.4,
    labelHeight:     25,
    labelPadTop:     0,
    labelPadBottom:  0,
    labelPadLeft:    0,
    labelPadRight:   0,
    // Typography
    fontFamily:      'Arial',
    drugFontSize:    6,
    drugFontBold:    true,
    batchFontSize:   5,
    signFontSize:    5,
    // Barcode decoder method: 'gs1' (GS1 AI parser) | 'legacy' (P0-P6 positional)
    barcodeMethod:   'gs1',
    // EV54 pick list: when true, reject codes not in the EV54 Drugs table.
    restrictToEV54List: false,
    // GTIN QR label sizing (Settings → General → GTIN QR Label)
    gtinQrSizeMm:         0,    // 0 = auto-fill; positive = fixed mm
    gtinItemCodeFontSize: 5,    // pt, item code text below QR code
    // NOTE: feature flags moved to COMPUTER_PROFILES (per-machine). See getProfileForComputer.
  })
}
export function saveSettings(settings) {
  save(KEYS.SETTINGS, { ...getSettings(), ...settings })
}

// ── GTIN MAP ──────────────────────────────────────────────────────────────────
/** Returns { GTIN: 'ITEMCODE', … } */
export function getGtinMap()      { return load(KEYS.GTIN_MAP, {}) }
export function saveGtinMap(map)  { save(KEYS.GTIN_MAP, map) }
export function findByGtin(gtin)  { return getGtinMap()[gtin.trim()] || null }
/** Reverse lookup: itemCode → GTIN (first match) */
export function findGtinByCode(itemCode) {
  const entry = Object.entries(getGtinMap()).find(
    ([, code]) => code.toUpperCase() === itemCode.trim().toUpperCase()
  )
  return entry ? entry[0] : null
}

// ── DATA SOURCE PATHS ─────────────────────────────────────────────────────────
export function getDataPaths() {
  return load(KEYS.DATA_PATHS, {
    phq:         '',
    location:    '\\\\nltpha-nas01\\PharmShare\\Programme Data\\ItemLocationXls.xls',
    mobileShelf: '',
    ev54Drugs:   '',
    gtin:        '\\\\nltpha-nas01\\PharmShare\\Programme Data\\Database\\Replenishment.accdb',
    stockOnhand: '\\\\nltpha-nas01\\PharmShare\\Programme Data\\StockOnhand\\Stock Onhand.xlsx',
  })
}
export function saveDataPaths(paths) {
  save(KEYS.DATA_PATHS, { ...getDataPaths(), ...paths })
}

// ── STOCK ON-HAND ─────────────────────────────────────────────────────────────
// Pulled from the Main Store \Stock Onhand.xlsx. For each item code, only the
// lot with the longest expiry is retained (plus its qty).
export function getStockOnhand()             { return load(KEYS.STOCK_ONHAND, {}) }
export function saveStockOnhand(map, meta)   {
  save(KEYS.STOCK_ONHAND, map)
  if (meta) save(KEYS.STOCK_ONHAND_META, meta)
}
export function getStockForItem(code)        {
  return getStockOnhand()[code.trim().toUpperCase()] || null
}
export function getStockOnhandMeta()         {
  return load(KEYS.STOCK_ONHAND_META, { sourceDate: null, refreshedAt: null })
}

// ── COMPUTER PROFILES ─────────────────────────────────────────────────────────
// Per-workstation feature access. NLTPMS0010 = full access; other machines get
// Drug Enquiry only unless the session is unlocked with the admin PIN.
const ALL_FEATURE_FLAGS = [
  'enableSmallLabel', 'enableReconstitution', 'enableEV54Tools',
  'enableAbxTab', 'enableExtempTab', 'enablePrepackTab',
  'enablePickListTab', 'enableGtinLabelTab',
  'enableMaintenance', 'enableSettings',
]
export function getFeatureFlagList() { return [...ALL_FEATURE_FLAGS] }
export function allFlagsTrue() {
  return ALL_FEATURE_FLAGS.reduce((o, k) => (o[k] = true, o), {})
}
export function allFlagsFalse() {
  return ALL_FEATURE_FLAGS.reduce((o, k) => (o[k] = false, o), {})
}
export function getComputerProfiles() {
  return load(KEYS.COMPUTER_PROFILES, {
    NLTPMS0010: allFlagsTrue(),
  })
}
export function saveComputerProfiles(map) { save(KEYS.COMPUTER_PROFILES, map) }
export function getProfileForComputer(name) {
  const key = (name || '').trim().toUpperCase()
  const profiles = getComputerProfiles()
  const match = Object.entries(profiles).find(([k]) => k.toUpperCase() === key)
  return match ? match[1] : allFlagsFalse()
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────────
export function exportAllData() {
  if (ts.isConnected()) return JSON.stringify(ts.getAll(), null, 2)
  const data = {}
  Object.values(KEYS).forEach(k => { data[k] = load(k, null) })
  return JSON.stringify(data, null, 2)
}

export async function importAllData(jsonString) {
  const data = JSON.parse(jsonString)
  Object.entries(data).forEach(([k, v]) => { if (v !== null) lsSet(k, v) })
  if (ts.isConnected())      await ts.setAll(data)
  else if (fs.isConnected()) await fs.setAll(data)
}

// ── FRESH-INSTALL SEED ────────────────────────────────────────────────────────
// Considered a fresh install when the drugs list is missing/empty in every
// active backing store. Tauri / File-API connected users with real data never
// trigger the seed.
export function isFreshInstall() {
  try {
    const localDrugs = lsGet(KEYS.DRUGS, null)
    if (Array.isArray(localDrugs) && localDrugs.length > 0) return false
    if (ts.isConnected()) {
      const d = ts.get(KEYS.DRUGS, null)
      if (Array.isArray(d) && d.length > 0) return false
    }
    if (fs.isConnected()) {
      const d = fs.get(KEYS.DRUGS, null)
      if (Array.isArray(d) && d.length > 0) return false
    }
    return true
  } catch { return false }
}

export async function seedFromBundle(seedObject) {
  await importAllData(JSON.stringify(seedObject))
}
