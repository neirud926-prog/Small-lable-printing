/**
 * dataLoader.js — auto-imports 3 data sources on startup (Tauri only).
 *
 * Sources (paths stored in settings):
 *   1. PHQ .txt    — drug list (itemCode, name, unit, isSpecial)
 *   2. Location .xls — bin locations (itemCode → Bin No.)
 *   3. GTIN .accdb  — barcode map (GTIN → itemCode) via PowerShell bridge
 */

import { readTextFile } from '@tauri-apps/plugin-fs'
import { invoke }       from '@tauri-apps/api/core'
import * as XLSX        from 'xlsx'
import {
  getDataPaths, saveDrugs, saveItemLocations, saveGtinMap, getDrugs,
  saveMobileShelf, saveEV54Drugs,
} from './storage'
import { extractMobileShelf, extractEV54Drugs } from './excelImporter'
import { isTauri }      from './tauriStorage'

// ── PHQ .txt parser ───────────────────────────────────────────────────────────
// Hospital system exports tab-separated rows: col[0]=itemCode, col[1]=name,
// col[14]=unit, col[15]=isSpecial('Y'/'N'). Falls back to 2-col space format.
function parsePHQText(text) {
  const drugs = []
  const seen  = new Set()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line) continue

    let cols
    if (line.includes('\t')) {
      cols = line.split('\t')
    } else {
      // Fixed-width / multi-space: split on 2+ consecutive spaces
      cols = line.trim().split(/\s{2,}/)
    }

    const itemCode = (cols[0] || '').trim().toUpperCase()
    if (!itemCode || seen.has(itemCode)) continue
    seen.add(itemCode)

    drugs.push({
      id:        itemCode,
      itemCode,
      name:      (cols[1]  || '').trim(),
      unit:      (cols[14] || '').trim(),
      isSpecial: (cols[15] || '').trim().toUpperCase() === 'Y',
    })
  }
  return drugs
}

// ── Item Location .xls parser ─────────────────────────────────────────────────
// Reads binary via Tauri fs, passes Uint8Array to SheetJS.
async function loadLocationXls(path) {
  const binary  = await invoke('read_binary_file', { path })
  const arr     = new Uint8Array(binary)
  const wb      = XLSX.read(arr, { type: 'array' })
  const ws      = wb.Sheets[wb.SheetNames[0]]
  const rows    = XLSX.utils.sheet_to_json(ws)
  const map     = {}

  // Detect column names from first row keys
  const keys = rows.length > 0 ? Object.keys(rows[0]) : []
  const codeKey = keys.find(k => /item.?code/i.test(k)) || keys[0]
  const binKey  = keys.find(k => /bin|location|loc/i.test(k))  || keys[1]

  for (const row of rows) {
    const code = (
      row['Item Code'] || row['itemCode'] || row['ITEM CODE'] ||
      row['Item_Code'] || row['ItemCode'] || row['ITEMCODE'] ||
      (codeKey ? row[codeKey] : '') || ''
    ).toString().trim().toUpperCase()

    const bin = (
      row['Bin No.']  || row['BIN NO.'] || row['Bin_No'] ||
      row['Location'] || row['location'] || row['LOCATION'] ||
      row['BIN']      || row['Bin']      || row['bin'] ||
      row['Loc']      || row['LOC']      || row['loc'] ||
      (binKey ? row[binKey] : '') || ''
    ).toString().trim()

    if (code && bin) map[code] = bin
  }
  return map
}

// ── Mobile Shelf .xls/.xlsx parser ────────────────────────────────────────────
// Same binary pipeline as loadLocationXls, but maps to the Mobile Shelf store.
export async function loadMobileShelfXls(path) {
  const binary = await invoke('read_binary_file', { path })
  const arr    = new Uint8Array(binary)
  const wb     = XLSX.read(arr, { type: 'array' })
  const ws     = wb.Sheets[wb.SheetNames[0]]
  const rows   = XLSX.utils.sheet_to_json(ws)
  const map    = {}
  for (const { itemCode, bin } of extractMobileShelf(rows)) {
    if (itemCode && bin) map[itemCode] = bin
  }
  return map
}

// ── EV54 Drugs .xls/.xlsx parser ──────────────────────────────────────────────
// Returns an array of { itemCode, name, evLocator } suitable for saveEV54Drugs.
export async function loadEV54DrugsXls(path) {
  const binary = await invoke('read_binary_file', { path })
  const arr    = new Uint8Array(binary)
  const wb     = XLSX.read(arr, { type: 'array' })
  const ws     = wb.Sheets[wb.SheetNames[0]]
  const rows   = XLSX.utils.sheet_to_json(ws)
  return extractEV54Drugs(rows)
}

// ── GTIN .accdb reader ────────────────────────────────────────────────────────
// Calls a Rust command that runs PowerShell → OleDB to query the Access db.
async function loadGtinAccdb(path) {
  try {
    const records = await invoke('query_gtin_db', { path })  // returns [{ItemCode, GTIN}]
    const map = {}
    for (const r of records) {
      if (r.GTIN && r.ItemCode) map[r.GTIN.toString().trim()] = r.ItemCode.toString().trim().toUpperCase()
    }
    return map
  } catch (e) {
    console.warn('GTIN .accdb load failed:', e)
    return null   // null = skip, don't wipe existing data
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────
/**
 * Called on startup after Tauri storage init.
 * Returns { phqLoaded, locationLoaded, gtinLoaded, errors[] }
 */
export async function autoLoad() {
  if (!isTauri()) return { skipped: true }

  const paths  = getDataPaths()
  const errors = []
  let phqLoaded = false, locationLoaded = false, gtinLoaded = false
  let mobileShelfLoaded = false, ev54DrugsLoaded = false

  // 1. PHQ drug list
  if (paths.phq) {
    try {
      const text  = await readTextFile(paths.phq)
      const drugs = parsePHQText(text)
      if (drugs.length > 0) {
        saveDrugs(drugs)
        phqLoaded = true
      }
    } catch (e) {
      errors.push(`PHQ: ${e.message || e}`)
    }
  }

  // 2. Item locations
  if (paths.location) {
    try {
      const map = await loadLocationXls(paths.location)
      if (Object.keys(map).length > 0) {
        saveItemLocations(map)
        locationLoaded = true
      }
    } catch (e) {
      errors.push(`Location: ${e.message || e}`)
    }
  }

  // 3. Mobile Shelf / Wooden Cabinet
  if (paths.mobileShelf) {
    try {
      const map = await loadMobileShelfXls(paths.mobileShelf)
      if (Object.keys(map).length > 0) {
        saveMobileShelf(map)
        mobileShelfLoaded = true
      }
    } catch (e) {
      errors.push(`Mobile Shelf: ${e.message || e}`)
    }
  }

  // 4. EV54 Drugs allowlist
  if (paths.ev54Drugs) {
    try {
      const list = await loadEV54DrugsXls(paths.ev54Drugs)
      if (list.length > 0) {
        saveEV54Drugs(list)
        ev54DrugsLoaded = true
      }
    } catch (e) {
      errors.push(`EV54 Drugs: ${e.message || e}`)
    }
  }

  // 5. GTIN map
  if (paths.gtin) {
    try {
      const map = await loadGtinAccdb(paths.gtin)
      if (map !== null) {
        saveGtinMap(map)
        gtinLoaded = true
      }
    } catch (e) {
      errors.push(`GTIN: ${e.message || e}`)
    }
  }

  return {
    phqLoaded, locationLoaded, mobileShelfLoaded, ev54DrugsLoaded, gtinLoaded,
    errors,
  }
}
