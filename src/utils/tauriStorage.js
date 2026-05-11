/**
 * tauriStorage.js — native file-system db for Tauri builds.
 *
 * Reads/writes one JSON file. Every set() triggers an immediate disk write
 * (matches the Excel `Workbook.Save` pattern — no drafts, no export button,
 * no data loss on unexpected close).
 *
 * MULTI-PC SYNC
 * ─────────────
 * The data-file path is per-PC config (stored in localStorage under
 * SML_DATA_PATH_KEY) so each PC can be pointed at a shared UNC location.
 * To share data between PCs, set every PC's path to the same UNC file:
 *     \\SERVER\pharmacy-share\small-label-data.json
 * The default `D:/SmallLabel/small-label-data.json` keeps existing
 * single-PC installs working.
 */

import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'

// ── Configuration ───────────────────────────────────────────────────────────
export const DEFAULT_DATA_PATH = 'D:/SmallLabel/small-label-data.json'
export const SML_DATA_PATH_KEY = 'sml_dataPath'

/** Current data-file path. Read fresh from localStorage in case Settings updated it. */
export function getDataPath() {
  try {
    const stored = (typeof localStorage !== 'undefined') && localStorage.getItem(SML_DATA_PATH_KEY)
    if (stored && stored.trim()) return stored.trim()
  } catch { /* ignore */ }
  return DEFAULT_DATA_PATH
}

/** Persist a new data path. Caller is responsible for re-init() and page reload. */
export function setDataPath(path) {
  try {
    if (path && path.trim()) localStorage.setItem(SML_DATA_PATH_KEY, path.trim())
    else                     localStorage.removeItem(SML_DATA_PATH_KEY)
  } catch { /* ignore */ }
}

/** Derive the parent directory from a file path (handles both / and \ separators). */
function dirOf(filePath) {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return i > 0 ? filePath.substring(0, i) : filePath
}

// ── Tauri detection ─────────────────────────────────────────────────────────
export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ── Module state ────────────────────────────────────────────────────────────
let _cache       = null    // parsed data object (in-memory)
let _connected   = false
let _writeQueue  = Promise.resolve()   // serializes concurrent writes
let _activePath  = null    // path that init() actually opened
let _writeFailed = false   // true while the most recent write was rejected

export function isConnected()    { return _connected }
export function getFilePath()    { return _activePath || getDataPath() }
export function lastWriteFailed(){ return _writeFailed }

// ── Init ────────────────────────────────────────────────────────────────────
/** Call on startup. Creates the folder + empty file if missing. */
export async function init() {
  if (!isTauri()) return false

  const path = getDataPath()
  const dir  = dirOf(path)

  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true })
  }

  if (!(await exists(path))) {
    await writeTextFile(path, '{}')
    _cache = {}
  } else {
    const text = (await readTextFile(path)).trim()
    _cache = text ? JSON.parse(text) : {}
  }

  _activePath = path
  _connected  = true

  // Hydrate: any sml_* key present in localStorage but missing from the file
  // (e.g. left over from seedFromBundle running before init, or from a session
  // when _flush() was poisoned by a transient write failure) is copied into
  // the cache and persisted. Without this, the shared file silently drifts
  // out of sync with what this PC's UI displays.
  let hydratedAny = false
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('sml_')) continue
      if (k === SML_DATA_PATH_KEY) continue   // per-PC config, not shared
      if (_cache[k] !== undefined) continue
      const raw = localStorage.getItem(k)
      if (raw === null) continue
      try { _cache[k] = JSON.parse(raw) } catch { _cache[k] = raw }
      hydratedAny = true
    }
  } catch { /* localStorage iteration failed — non-fatal */ }
  if (hydratedAny) await _flush()

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
  return _flush()
}

export function getAll()       { return { ..._cache } }
export function setAll(data)   { _cache = { ...data }; return _flush() }

/**
 * Repoint the live cache at a new file and write `data` into it.
 * Used by import-with-shared-path so the imported payload lands on the
 * new shared file (not the previously-active local one).
 */
export async function switchPath(newPath, data) {
  if (!newPath || !newPath.trim()) throw new Error('switchPath: empty path')
  const path = newPath.trim()
  const dir  = dirOf(path)
  if (!(await exists(dir))) await mkdir(dir, { recursive: true })
  _cache      = { ...data }
  _activePath = path
  await _flush()
}

// Serialize writes so a burst of set() calls produces one file I/O queue,
// not overlapping writes that can corrupt the file mid-flight.
//
// IMPORTANT: A .then(onFulfilled) chain stops calling onFulfilled the moment
// any upstream promise rejects, so a single failed write would poison
// _writeQueue for the rest of the session and silently drop every subsequent
// save. The .then(ok, fail) form below runs the next write regardless of
// the previous outcome, and a trailing .catch() turns rejection into a
// resolved sentinel so the queue keeps flowing.
function _flush() {
  const content = JSON.stringify(_cache, null, 2)
  const path    = _activePath || getDataPath()
  const attempt = _writeQueue.then(
    () => writeTextFile(path, content),
    () => writeTextFile(path, content),
  )
  _writeQueue = attempt.then(
    () => { _writeFailed = false },
    (err) => {
      _writeFailed = true
      const detail = err?.message || String(err)
      try { console.error('tauriStorage write failed:', detail) } catch { /* ignore */ }
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sml:storage-write-error', { detail }))
        }
      } catch { /* ignore */ }
    },
  )
  return attempt
}
