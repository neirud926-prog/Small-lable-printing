/**
 * serverStorage.js — shared data via the Express REST server (app.js)
 *
 * The app POSTs/GETs data through /api/store on the server, which persists
 * everything in shared-data.json.  No file-picker or permission prompts:
 * once the URL is saved to localStorage the app auto-connects on every load.
 *
 * Polls every 30 s so other PCs see updates automatically.
 */

const LS_KEY        = 'sml_serverUrl'   // persisted server URL
const TIMEOUT_MS    = 3_000
const POLL_INTERVAL = 30_000

let _baseUrl        = ''
let _connected      = false
let _cache          = {}
let _lastStoreStr   = ''
let _pollTimer      = null
let _onRemoteChange = null

export function isConnected() { return _connected }
export function getBaseUrl()  { return _baseUrl }

export function onRemoteChange(cb) { _onRemoteChange = cb }

// ── Internal helpers ──────────────────────────────────────────────────────────
function _abort(ms) {
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

async function _get(base, path) {
  const res = await fetch(base + path, { signal: _abort(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Connect ───────────────────────────────────────────────────────────────────
async function _doConnect(base) {
  const ping = await _get(base, '/api/ping')
  if (!ping?.ok) throw new Error('ping failed')
  const store = await _get(base, '/api/store')
  _baseUrl      = base
  _cache        = store
  _lastStoreStr = JSON.stringify(store)
  _connected    = true
  _startPoll()
}

/** Try to reconnect using the previously saved server URL. */
export async function tryRestore() {
  const url = localStorage.getItem(LS_KEY)
  if (!url) return false
  try {
    await _doConnect(url)
    return true
  } catch {
    return false
  }
}

/** Connect to a new server URL; saves URL on success. */
export async function tryConnect(url) {
  const base = url.replace(/\/$/, '')
  try {
    await _doConnect(base)
    localStorage.setItem(LS_KEY, base)
    return true
  } catch {
    return false
  }
}

/** Disconnect and forget the saved URL. */
export function disconnect() {
  _connected = false
  _baseUrl   = ''
  _cache     = {}
  _stopPoll()
  localStorage.removeItem(LS_KEY)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export function get(key, fallback) {
  return _cache[key] !== undefined ? _cache[key] : fallback
}

export function set(key, value) {
  _cache[key] = value
  fetch(`${_baseUrl}/api/store/${encodeURIComponent(key)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ value }),
  }).catch(() => {})
}

export function setAll(data) {
  _cache = { ...data }
  return fetch(`${_baseUrl}/api/store`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  }).then(r => { if (!r.ok) throw new Error() }).catch(() => {})
}

export function getAll() { return { ..._cache } }

// ── Polling ───────────────────────────────────────────────────────────────────
function _startPoll() {
  if (_pollTimer) return
  _pollTimer = setInterval(_poll, POLL_INTERVAL)
}
function _stopPoll() {
  clearInterval(_pollTimer)
  _pollTimer = null
}
async function _poll() {
  if (!_baseUrl) return
  try {
    const store = await _get(_baseUrl, '/api/store')
    const str = JSON.stringify(store)
    if (str !== _lastStoreStr) {
      _cache        = store
      _lastStoreStr = str
      _onRemoteChange?.()
    }
  } catch { /* ignore transient errors */ }
}
