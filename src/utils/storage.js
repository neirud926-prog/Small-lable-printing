/**
 * storage.js — unified data layer
 *
 * Priority:
 *   1. SERVER  (Express server via /api/store)   — best for multi-PC, auto-reconnects
 *   2. FILE    (shared JSON via File System API) — Chrome only, needs permission each session
 *   3. LOCAL   (localStorage)                    — single PC only
 *
 * localStorage is always kept as a write-through backup.
 */

import * as ss from './serverStorage'
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
  if (ss.isConnected()) return ss.get(key, lsGet(key, fallback))
  if (fs.isConnected()) return fs.get(key, lsGet(key, fallback))
  return lsGet(key, fallback)
}

function save(key, value) {
  lsSet(key, value)             // always write localStorage as backup
  if (ss.isConnected())      ss.set(key, value)
  else if (fs.isConnected()) fs.set(key, value)
}

// ── Key constants ─────────────────────────────────────────────────────────────
const KEYS = {
  DRUGS:          'sml_drugs',
  EXPIRY_RULES:   'sml_expiryRules',
  ABX:            'sml_abx',
  PREPACK:        'sml_prepack',
  EXTEMP:         'sml_extemp',
  EXP_AFTER_OPEN: 'sml_expAfterOpen',
  BATCH_RECORDS:  'sml_batchRecords',
  BATCH_COUNTERS: 'sml_batchCounters',
  SETTINGS:       'sml_settings',
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

// ── SETTINGS ──────────────────────────────────────────────────────────────────
export function getSettings() {
  return load(KEYS.SETTINGS, {
    location:        'IP/OP',
    printerName:     'Thermal GX420t - PMS',
    maintenancePin:  'NLTH',
    showPrintDialog: true,
    phqDatabasePath: '',
  })
}
export function saveSettings(settings) {
  save(KEYS.SETTINGS, { ...getSettings(), ...settings })
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────────
export function exportAllData() {
  if (ss.isConnected()) return JSON.stringify(ss.getAll(), null, 2)
  const data = {}
  Object.values(KEYS).forEach(k => { data[k] = load(k, null) })
  return JSON.stringify(data, null, 2)
}

export async function importAllData(jsonString) {
  const data = JSON.parse(jsonString)
  Object.entries(data).forEach(([k, v]) => { if (v !== null) lsSet(k, v) })
  if (ss.isConnected())      await ss.setAll(data)
  else if (fs.isConnected()) await fs.setAll(data)
}
