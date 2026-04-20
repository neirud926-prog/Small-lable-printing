import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettings, saveSettings, exportAllData, importAllData,
         getDataPaths, saveDataPaths } from '../utils/storage'
import { isConnected as isFileConnected, getFileName, disconnect as fileDisconnect } from '../utils/fileStorage'
import { isConnected as isTauriConnected, getFilePath as getTauriPath } from '../utils/tauriStorage'
import { autoLoad } from '../utils/dataLoader'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../utils/tauriStorage'

const LOCATIONS = ['IP/OP', 'EC', 'SM']

export default function Settings({ navigate }) {
  const [settings, _setSettings] = useState(getSettings)
  const [saved, setSaved]        = useState(false)
  const [pinForm, setPinForm]    = useState({ current: '', newPin: '', confirm: '' })
  const [pinMsg, setPinMsg]      = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [dataPaths, setDataPaths] = useState(getDataPaths)
  const [refreshMsg, setRefreshMsg] = useState('')
  const [printers, setPrinters]  = useState([])

  // Load available printers from the Tauri backend on first render
  useEffect(() => {
    if (!isTauri()) return
    invoke('list_printers')
      .then(list => { if (Array.isArray(list)) setPrinters(list) })
      .catch(() => {}) // non-critical — falls back to text input
  }, [])

  const set = (k, v) => _setSettings(s => ({ ...s, [k]: v }))

  const setPath = (k, v) => setDataPaths(p => ({ ...p, [k]: v }))

  const savePathsToDisk = (updated) => {
    saveDataPaths(updated)
  }

  const browsePath = async (key, filters) => {
    if (!isTauri()) return
    try {
      const selected = await openDialog({ multiple: false, filters })
      if (selected) {
        const updated = { ...dataPaths, [key]: selected }
        setDataPaths(updated)
        savePathsToDisk(updated)
      }
    } catch { /* user cancelled */ }
  }

  const handleRefreshNow = async () => {
    setRefreshMsg('Refreshing…')
    try {
      const result = await autoLoad()
      const loaded = [
        result.phqLoaded          && 'PHQ drugs',
        result.locationLoaded     && 'Locations',
        result.mobileShelfLoaded  && 'Mobile Shelf',
        result.ev54DrugsLoaded    && 'EV54 Drugs',
        result.gtinLoaded         && 'GTIN',
      ].filter(Boolean)
      const msg = loaded.length
        ? `✓ Refreshed: ${loaded.join(', ')}`
        : result.errors?.length
          ? `✗ ${result.errors.join(' | ')}`
          : '— No paths configured'
      setRefreshMsg(msg)
    } catch (e) {
      setRefreshMsg(`✗ ${e.message || e}`)
    }
    setTimeout(() => setRefreshMsg(''), 5000)
  }

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handlePinChange = () => {
    const current = getSettings()
    if (pinForm.current !== current.maintenancePin) {
      setPinMsg('Current PIN is incorrect.')
      return
    }
    if (pinForm.newPin !== pinForm.confirm) {
      setPinMsg('New PINs do not match.')
      return
    }
    if (pinForm.newPin.length < 4) {
      setPinMsg('PIN must be at least 4 characters.')
      return
    }
    saveSettings({ maintenancePin: pinForm.newPin })
    _setSettings(s => ({ ...s, maintenancePin: pinForm.newPin }))
    setPinMsg('✓ PIN changed successfully.')
    setPinForm({ current: '', newPin: '', confirm: '' })
    setTimeout(() => setPinMsg(''), 3000)
  }

  const handleExport = () => {
    const data = exportAllData()
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `small-label-backup-${new Date().toLocaleDateString('en-CA')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        await importAllData(ev.target.result)
        setImportMsg('✓ Data imported successfully. Refresh the page.')
        setTimeout(() => setImportMsg(''), 4000)
      } catch {
        setImportMsg('✗ Import failed — invalid file format.')
        setTimeout(() => setImportMsg(''), 4000)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>

        {/* Data connection status */}
        {(() => {
          const tauriOk = isTauriConnected()
          const fileOk  = isFileConnected()
          const color  = tauriOk ? 'var(--primary)' : fileOk ? 'var(--success)' : 'var(--warning)'
          const icon   = tauriOk ? '💾' : fileOk ? '🗂️' : '💻'
          const title  = tauriOk ? 'Auto-save Active' : fileOk ? 'Shared File Connected' : 'Local Storage Only'
          const detail = tauriOk ? `Every change is written to ${getTauriPath()}`
                       : fileOk  ? `File: ${getFileName()}`
                       : 'Data is stored in this browser only. Install the desktop app for automatic disk persistence.'

          const handleDisconnect = async () => {
            if (fileOk) await fileDisconnect()
            window.location.reload()
          }

          return (
            <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{detail}</div>
                </div>
                {fileOk && !tauriOk && (
                  <button className="btn btn-ghost btn-sm" onClick={handleDisconnect}>
                    Change
                  </button>
                )}
              </div>
            </div>
          )
        })()}

        {/* Data Sources */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📂 Data Sources</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>
            Paths are read on every app startup and when you click Refresh Now.
          </div>

          {[
            { key: 'phq',         label: 'PHQ Drug List',   hint: '.txt',       filters: [{ name: 'Text',   extensions: ['txt'] }] },
            { key: 'location',    label: 'Item Location',   hint: '.xls',       filters: [{ name: 'Excel',  extensions: ['xls','xlsx'] }] },
            { key: 'mobileShelf', label: 'Mobile Shelf',    hint: '.xls/.xlsx', filters: [{ name: 'Excel',  extensions: ['xls','xlsx'] }] },
            { key: 'ev54Drugs',   label: 'EV54 Drugs',      hint: '.xls/.xlsx', filters: [{ name: 'Excel',  extensions: ['xls','xlsx'] }] },
            { key: 'gtin',        label: 'GTIN Database',   hint: '.accdb',     filters: [{ name: 'Access', extensions: ['accdb','mdb'] }] },
          ].map(({ key, label, hint, filters }) => (
            <div key={key} className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">{label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({hint})</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
                  value={dataPaths[key] || ''}
                  onChange={e => {
                    const updated = { ...dataPaths, [key]: e.target.value }
                    setDataPaths(updated)
                    savePathsToDisk(updated)
                  }}
                  placeholder={`e.g. D:\\Data\\${hint === '.txt' ? 'PHQ.txt' : hint === '.xls' ? 'ItemLocation.xls' : 'GTIN.accdb'}`}
                />
                {isTauri() && (
                  <button className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}
                    onClick={() => browsePath(key, filters)}>
                    Browse…
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" onClick={handleRefreshNow}>
              🔄 Refresh Now
            </button>
            {refreshMsg && (
              <span style={{ fontSize: 12, color: refreshMsg.startsWith('✓') ? 'var(--success)' : refreshMsg.startsWith('✗') ? 'var(--danger)' : 'var(--text-muted)' }}>
                {refreshMsg}
              </span>
            )}
          </div>
        </div>

        {/* General Settings */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>⚙️ General</div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <div className="section-toggle-group">
              {LOCATIONS.map(loc => (
                <button key={loc} className={`section-toggle ${settings.location === loc ? 'active' : ''}`}
                  onClick={() => set('location', loc)}>
                  {loc}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Affects which batch counter is used (EC counter vs IP/OP counter).
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Thermal Printer</label>
            {isTauri() && printers.length > 0 ? (
              <select
                className="form-select"
                value={settings.printerName}
                onChange={e => set('printerName', e.target.value)}
              >
                <option value="">— Select a printer —</option>
                {printers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                className="form-input"
                value={settings.printerName}
                onChange={e => set('printerName', e.target.value)}
                placeholder="e.g. Thermal GX420t - PMS"
              />
            )}
            {isTauri() && printers.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                No printers detected — enter the name manually or check that the app has access.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">PHQ Database Path</label>
            <input className="form-input" value={settings.phqDatabasePath || ''} onChange={e => set('phqDatabasePath', e.target.value)}
              placeholder="e.g. \\\\server\\path\\to\\database.mdb" />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Network path or local path to PHQ database (optional, for future integration).
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.showPrintDialog} onChange={e => set('showPrintDialog', e.target.checked)} />
            <div>
              <div style={{ fontWeight: 600 }}>Show print dialog</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Shows the OS print dialog before each label. Uncheck to print straight to the default printer.</div>
            </div>
          </label>

          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
              cursor: isTauri() ? 'pointer' : 'not-allowed',
              marginTop: 12, padding: '10px 12px',
              borderRadius: 8, border: '1px solid var(--border)',
              background: settings.silentPrint && isTauri() ? 'var(--primary-light, #eff6ff)' : 'var(--bg)',
              opacity: isTauri() ? 1 : 0.55,
            }}
          >
            <input
              type="checkbox"
              checked={!!settings.silentPrint}
              onChange={e => set('silentPrint', e.target.checked)}
              disabled={!isTauri()}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                🖨️ Silent print (PowerShell + System.Drawing)
                {!isTauri() && (
                  <span style={{ fontSize: 11, color: 'var(--warning)', marginLeft: 8, fontWeight: 500 }}>
                    Desktop app only
                  </span>
                )}
              </div>
            </div>
          </label>
        </div>

        {/* Barcode Decoder */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📷 Barcode Decoder Method</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
            Controls how GTIN barcodes from drug boxes are parsed. Switch to Legacy if GS1 mode gives incorrect results for your scanner.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { value: 'gs1',    label: 'GS1 AI Parser',     desc: 'Recommended — reads Application Identifiers (01)(10)(17) in any order. Works with QR, Data Matrix, and GS1-128.' },
              { value: 'legacy', label: 'Legacy (P0–P6)',     desc: 'Original positional patterns. Use if your scanner outputs a non-standard format that the GS1 parser cannot handle.' },
            ].map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
                cursor: 'pointer', flex: 1, minWidth: 200,
                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: settings.barcodeMethod === opt.value ? 'var(--primary-light, #eff6ff)' : 'var(--bg)',
              }}>
                <input
                  type="radio"
                  name="barcodeMethod"
                  value={opt.value}
                  checked={settings.barcodeMethod === opt.value}
                  onChange={() => set('barcodeMethod', opt.value)}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Label & Printer Settings */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🏷️ Label Dimensions & Typography</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Adjust these if your printed labels don't fill the label stock correctly.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Label Width (mm)</label>
              <input className="form-input" type="number" step="0.1" value={settings.labelWidth ?? 34.4}
                onChange={e => set('labelWidth', parseFloat(e.target.value) || 34.4)} />
            </div>
            <div className="form-group">
              <label className="form-label">Label Height (mm)</label>
              <input className="form-input" type="number" step="0.1" value={settings.labelHeight ?? 25}
                onChange={e => set('labelHeight', parseFloat(e.target.value) || 25)} />
            </div>
            <div className="form-group">
              <label className="form-label">Font Family</label>
              <select className="form-select" value={settings.fontFamily || 'Arial'}
                onChange={e => set('fontFamily', e.target.value)}>
                {['Arial', 'Helvetica', 'Calibri', 'Tahoma', 'Verdana', 'Courier New', 'Times New Roman'].map(f =>
                  <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Pad Top (mm)</label>
              <input className="form-input" type="number" step="0.1" value={settings.labelPadTop ?? 1.8}
                onChange={e => set('labelPadTop', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label">Pad Bottom (mm)</label>
              <input className="form-input" type="number" step="0.1" value={settings.labelPadBottom ?? 1.4}
                onChange={e => set('labelPadBottom', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label">Pad Left (mm)</label>
              <input className="form-input" type="number" step="0.1" value={settings.labelPadLeft ?? 2.2}
                onChange={e => set('labelPadLeft', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label">Pad Right (mm)</label>
              <input className="form-input" type="number" step="0.1" value={settings.labelPadRight ?? 2.2}
                onChange={e => set('labelPadRight', parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Drug Name Size (pt)</label>
              <input className="form-input" type="number" step="0.5" value={settings.drugFontSize ?? 8.5}
                onChange={e => set('drugFontSize', parseFloat(e.target.value) || 8.5)} />
            </div>
            <div className="form-group">
              <label className="form-label">Batch No. Size (pt)</label>
              <input className="form-input" type="number" step="0.5" value={settings.batchFontSize ?? 6}
                onChange={e => set('batchFontSize', parseFloat(e.target.value) || 6)} />
            </div>
            <div className="form-group">
              <label className="form-label">Signature Size (pt)</label>
              <input className="form-input" type="number" step="0.5" value={settings.signFontSize ?? 5.5}
                onChange={e => set('signFontSize', parseFloat(e.target.value) || 5.5)} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={settings.drugFontBold !== false}
              onChange={e => set('drugFontBold', e.target.checked)} />
            <span>Bold drug name</span>
          </label>

          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            Default: 34.4 × 25 mm · Arial · Drug 6pt bold · Batch 5pt · Sign 5pt · No padding
          </div>
        </div>

        {/* Change PIN */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔒 Change Maintenance PIN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Current PIN</label>
              <input className="form-input" type="password" value={pinForm.current} onChange={e => setPinForm(f => ({ ...f, current: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">New PIN</label>
              <input className="form-input" type="password" value={pinForm.newPin} onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New PIN</label>
              <input className="form-input" type="password" value={pinForm.confirm} onChange={e => setPinForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handlePinChange}>Change PIN</button>
          <AnimatePresence>
            {pinMsg && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 13, marginTop: 10, color: pinMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
                {pinMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Data Backup */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>💾 Data Backup & Restore</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Export all app data (drugs, rules, records, settings) as a JSON file. Import to restore on another PC.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleExport}>⬇ Export Backup</button>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              ⬆ Import Backup
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
          </div>
          <AnimatePresence>
            {importMsg && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 13, marginTop: 10, color: importMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
                {importMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

    </div>
  )
}
