/**
 * Small Label Printing - Shared Server
 *
 * Stores all app data in a single JSON file so every PC on the network
 * shares the same database.
 *
 * Usage:
 *   node app.js                   (data saved to ./shared-data.json)
 *   node app.js --port 3000       (custom port)
 *   node app.js --data D:\Shared\label-data.json  (custom path)
 *
 * All PCs open: http://<THIS_PC_IP>:3000
 */

const express = require('express')
const fs      = require('fs')
const path    = require('path')
const os      = require('os')

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const PORT      = parseInt(getArg('--port') || '3000', 10)
const DATA_FILE = getArg('--data') || path.join(__dirname, 'shared-data.json')

// ── Helpers ───────────────────────────────────────────────────────────────────
function readStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('Warning: could not read data file, starting fresh.', e.message)
  }
  return {}
}

function writeStore(data) {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8')
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '50mb' }))

// CORS — allow any origin (LAN use only, not internet-exposed)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ── API routes ────────────────────────────────────────────────────────────────

// GET /api/store  → return full store
app.get('/api/store', (_req, res) => {
  res.json(readStore())
})

// POST /api/store/:key  → save one key
app.post('/api/store/:key', (req, res) => {
  const store = readStore()
  store[req.params.key] = req.body.value
  writeStore(store)
  res.json({ ok: true })
})

// DELETE /api/store/:key  → remove one key
app.delete('/api/store/:key', (req, res) => {
  const store = readStore()
  delete store[req.params.key]
  writeStore(store)
  res.json({ ok: true })
})

// POST /api/store  → bulk replace entire store (import backup)
app.post('/api/store', (req, res) => {
  writeStore(req.body)
  res.json({ ok: true })
})

// GET /api/ping  → health check (client uses this to detect server mode)
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, dataFile: DATA_FILE })
})

// ── Serve the built HTML ──────────────────────────────────────────────────────
const distIndex = path.join(__dirname, 'dist', 'index.html')
app.get(/.*/, (_req, res) => {
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex)
  } else {
    res.status(404).send(
      '<h2>App not built yet.</h2>' +
      '<p>Run <code>npm run build</code> first, then restart this server.</p>'
    )
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  // Print all network IPs so the user knows which URL to share
  const nets = os.networkInterfaces()
  const ips  = []
  for (const list of Object.values(nets)) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address)
    }
  }

  console.log('\n======================================')
  console.log('  Small Label Printing - Server')
  console.log('======================================')
  console.log(`  Data file : ${DATA_FILE}`)
  console.log(`  Port      : ${PORT}`)
  console.log('')
  console.log('  Open on THIS PC:')
  console.log(`    http://localhost:${PORT}`)
  console.log('')
  if (ips.length > 0) {
    console.log('  Share with OTHER PCs on the network:')
    ips.forEach(ip => console.log(`    http://${ip}:${PORT}`))
  }
  console.log('======================================\n')
})
