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
  GTIN_MAP:        'sml_gtinMap',         // { gtin → itemCode }
  DATA_PATHS:      'sml_dataPaths',       // { phq, location, gtin } file paths
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
    labelPadTop:     1.8,
    labelPadBottom:  1.4,
    labelPadLeft:    2.2,
    labelPadRight:   2.2,
    // Typography
    fontFamily:      'Arial',
    drugFontSize:    8.5,
    drugFontBold:    true,
    batchFontSize:   6,
    signFontSize:    5.5,
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

// ── DATA SOURCE PATHS ─────────────────────────────────────────────────────────
export function getDataPaths() {
  return load(KEYS.DATA_PATHS, { phq: '', location: '', gtin: '' })
}
export function saveDataPaths(paths) {
  save(KEYS.DATA_PATHS, { ...getDataPaths(), ...paths })
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
