/**
 * fileStorage.js — Shared data via File System Access API
 *
 * A single JSON file on a network drive acts as the shared database.
 * Every PC reads/writes the same file through Chrome's File System Access API.
 * No server, no installs required.
 *
 * Flow:
 *   1. On startup: try to restore a previously-saved file handle from IndexedDB
 *   2. If no handle: show FileConnect screen so the user picks the shared file
 *   3. All reads/writes go through an in-memory cache (sync) → file (async)
 *   4. A 30-second poll detects changes from other PCs and fires onRemoteChange()
 */

// ── IndexedDB — persists the file handle across sessions ──────────────────────
const IDB_DB    = 'sml_fs'
const IDB_STORE = 'handles'
const IDB_KEY   = 'dataFile'

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE)
    req.onsuccess  = e => resolve(e.target.result)
    req.onerror    = ()  => reject(req.error)
  })
}
async function idbGet(key) {
  const db = await openIDB()
  return new Promise(resolve => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => resolve(null)
  })
}
async function idbSet(key, value) {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = resolve
    tx.onerror    = () => reject(tx.error)
  })
}
async function idbDel(key) {
  const db = await openIDB()
  return new Promise(resolve => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = resolve
    tx.onerror    = () => resolve()
  })
}

// ── Module state ──────────────────────────────────────────────────────────────
let _handle       = null    // FileSystemFileHandle
let _cache        = null    // Parsed data object (in-memory)
let _lastContent  = ''      // Last-written JSON string (change-detect)
let _connected    = false
let _pollTimer    = null
let _onRemoteChange = null  // () => void  — called when another PC changed the file

export function isConnected()       { return _connected }
export function getFileName()       { return _handle?.name ?? localStorage.getItem('sml_connectedFileName') ?? '' }
export function onRemoteChange(cb)  { _onRemoteChange = cb }
export function hasStoredHandle()   { return !!localStorage.getItem('sml_connectedFileName') }

// ── Permission helper ─────────────────────────────────────────────────────────
async function ensurePermission(handle) {
  const opts = { mode: 'readwrite' }
  if (await handle.queryPermission(opts) === 'granted') return true
  try {
    // requestPermission() requires an active user gesture — may throw on file:// origins
    if (await handle.requestPermission(opts) === 'granted') return true
  } catch { /* no user gesture or disallowed context — fall through */ }
  return false
}

// ── Low-level file read / write ───────────────────────────────────────────────
async function readText(handle) {
  const file = await handle.getFile()
  return file.text()
}
async function writeText(handle, text) {
  const w = await handle.createWritable()
  await w.write(text)
  await w.close()
}

// ── Connect to a file handle ──────────────────────────────────────────────────
// skipPermCheck: true when coming from a picker (browser already granted access)
async function _connect(handle, skipPermCheck = false) {
  if (!skipPermCheck) {
    const ok = await ensurePermission(handle)
    if (!ok) throw new Error('Read-write permission was denied for the data file.')
  }

  let content = await readText(handle)
  if (!content.trim()) {
    content = '{}'
    await writeText(handle, content)
  }

  _cache       = JSON.parse(content)
  _lastContent = content
  _handle      = handle
  _connected   = true

  // Persist filename so UI can show it even before IndexedDB resolves
  try { localStorage.setItem('sml_connectedFileName', handle.name) } catch { /* ignore */ }

  _startPoll()
}

/** Call on startup — restores a previously saved handle; returns true if succeeded. */
export async function tryRestore() {
  try {
    const handle = await idbGet(IDB_KEY)
    if (!handle) return false
    await _connect(handle)
    await idbSet(IDB_KEY, handle) // re-save to refresh stored handle
    return true
  } catch {
    return false
  }
}

/** Open an existing JSON file (user-initiated picker). */
export async function pickExisting() {
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'JSON Data File', accept: { 'application/json': ['.json'] } }],
    multiple: false,
    mode: 'readwrite',
  })
  await _connect(handle, true)   // picker already granted access — skip perm check
  await idbSet(IDB_KEY, handle)
}

/** Create a new JSON file (user-initiated save picker). */
export async function createNew() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'small-label-data.json',
    types: [{ description: 'JSON Data File', accept: { 'application/json': ['.json'] } }],
  })
  await _connect(handle, true)   // save picker already granted access — skip perm check
  await idbSet(IDB_KEY, handle)
}

/** Forget the stored file (used in Settings to switch files). */
export async function disconnect() {
  _handle    = null
  _cache     = null
  _connected = false
  _stopPoll()
  try { localStorage.removeItem('sml_connectedFileName') } catch { /* ignore */ }
  await idbDel(IDB_KEY)
}

// ── Cache read/write (used by storage.js) ─────────────────────────────────────
export function get(key, fallback) {
  if (!_cache) return fallback
  return _cache[key] !== undefined ? _cache[key] : fallback
}

export function set(key, value) {
  if (!_cache) _cache = {}
  _cache[key] = value
  _flush()
}

export function setAll(data) {
  _cache = { ...data }
  return _flush()          // returns Promise — awaitable for import
}

export function getAll() {
  return { ..._cache }
}

function _flush() {
  if (!_handle) return Promise.resolve()
  const content = JSON.stringify(_cache, null, 2)
  _lastContent  = content
  return writeText(_handle, content).catch(() => {})
}

// ── Polling — detect changes from other PCs ────────────────────────────────────
function _startPoll() {
  if (_pollTimer) return
  _pollTimer = setInterval(_poll, 30_000)
}
function _stopPoll() {
  clearInterval(_pollTimer)
  _pollTimer = null
}
async function _poll() {
  if (!_handle) return
  try {
    const content = await readText(_handle)
    if (content && content !== _lastContent) {
      _cache       = JSON.parse(content)
      _lastContent = content
      _onRemoteChange?.()
    }
  } catch { /* ignore transient read errors */ }
}
