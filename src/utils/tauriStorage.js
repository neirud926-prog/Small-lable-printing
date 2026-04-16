/**
 * tauriStorage.js — native file-system db for Tauri builds.
 *
 * Reads/writes one JSON file at a fixed path. Every set() triggers an
 * immediate disk write (matches the Excel `Workbook.Save` pattern — no
 * drafts, no export button, no data loss on unexpected close).
 */

import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'

// ── Configuration ───────────────────────────────────────────────────────────
// Change this one constant to relocate the data file.
// For multi-PC sharing later, point it at a UNC path: '\\\\SERVER\\share\\small-label-data.json'
export const DATA_DIR  = 'D:/SmallLabel'
export const DATA_PATH = 'D:/SmallLabel/small-label-data.json'

// ── Tauri detection ─────────────────────────────────────────────────────────
export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ── Module state ────────────────────────────────────────────────────────────
let _cache      = null    // parsed data object (in-memory)
let _connected  = false
let _writeQueue = Promise.resolve()   // serializes concurrent writes

export function isConnected() { return _connected }
export function getFilePath() { return DATA_PATH }

// ── Init ────────────────────────────────────────────────────────────────────
/** Call on startup. Creates the folder + empty file if missing. */
export async function init() {
  if (!isTauri()) return false

  if (!(await exists(DATA_DIR))) {
    await mkdir(DATA_DIR, { recursive: true })
  }

  if (!(await exists(DATA_PATH))) {
    await writeTextFile(DATA_PATH, '{}')
    _cache = {}
  } else {
    const text = (await readTextFile(DATA_PATH)).trim()
    _cache = text ? JSON.parse(text) : {}
  }

  _connected = true
  return true
}

// ── Cache read/write ────────────────────────────────────────────────────────
export function get(key, fallback) {
  if (!_cache) return fallback
  return _cache[key] !== undefined ? _cache[key] : fallback
}

export function set(key, value) {
  if (!_cache) _cache = {}
  _cache[key] = value
  _flush()
}

export function getAll()       { return { ..._cache } }
export function setAll(data)   { _cache = { ...data }; return _flush() }

// Serialize writes so a burst of set() calls produces one file I/O queue,
// not overlapping writes that can corrupt the file mid-flight.
function _flush() {
  const content = JSON.stringify(_cache, null, 2)
  _writeQueue = _writeQueue.then(() => writeTextFile(DATA_PATH, content))
  return _writeQueue
}
