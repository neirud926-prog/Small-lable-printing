import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettings, saveSettings, exportAllData, importAllData } from '../utils/storage'
import { isConnected, getFileName, disconnect } from '../utils/fileStorage'

const LOCATIONS = ['IP/OP', 'EC', 'SM']

export default function Settings({ navigate }) {
  const [settings, _setSettings] = useState(getSettings)
  const [saved, setSaved]        = useState(false)
  const [pinForm, setPinForm]    = useState({ current: '', newPin: '', confirm: '' })
  const [pinMsg, setPinMsg]      = useState('')
  const [importMsg, setImportMsg] = useState('')

  const set = (k, v) => _setSettings(s => ({ ...s, [k]: v }))

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
    <div className="page">
      <div className="page-header">
        <button className="btn btn-back" onClick={() => navigate('menu')}>‹</button>
        <h1>Settings</h1>
        <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ marginLeft: 'auto' }}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Shared file status */}
        <div className="card" style={{ borderLeft: `4px solid ${isConnected() ? 'var(--success)' : 'var(--warning)'}`, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ fontSize: 20 }}>{isConnected() ? '🗂️' : '💻'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                {isConnected() ? 'Shared File Connected' : 'Not connected to shared file'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {isConnected()
                  ? `Data file: ${getFileName()}`
                  : 'Using local storage on this PC only.'}
              </div>
            </div>
            {isConnected() && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => { await disconnect(); window.location.reload() }}
              >
                Change File
              </button>
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
            <label className="form-label">Thermal Printer Name</label>
            <input className="form-input" value={settings.printerName} onChange={e => set('printerName', e.target.value)}
              placeholder="e.g. Thermal GX420t - PMS" />
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
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Uncheck if you have configured Chrome to auto-print silently (see guide below).</div>
            </div>
          </label>
        </div>

        {/* Auto-Print Setup Guide */}
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🖨️ Chrome Auto-Print Setup Guide</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
            <p style={{ marginBottom: 8 }}>To make Chrome print silently to your thermal printer without showing a dialog:</p>
            <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Open Chrome and go to <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>chrome://settings/printing</code></li>
              <li>Under <strong>Default printer</strong>, select your thermal printer: <strong>{settings.printerName}</strong></li>
              <li>Open Chrome with the <strong>--kiosk-printing</strong> flag to skip the dialog automatically:<br />
                <code style={{ background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, fontSize: 12, display: 'inline-block', marginTop: 4 }}>
                  chrome.exe --kiosk-printing "file:///path/to/index.html"
                </code>
              </li>
              <li>Or create a shortcut on the desktop with the above command as the target.</li>
            </ol>
            <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>
              <strong>Note:</strong> Without --kiosk-printing, Chrome will always show the print dialog. Staff can still select the correct printer manually.
            </p>
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
    </div>
  )
}
