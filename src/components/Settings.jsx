import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettings, saveSettings, exportAllData, importAllData,
         getDataPaths, saveDataPaths,
         getComputerProfiles, saveComputerProfiles, getFeatureFlagList, allFlagsTrue, allFlagsFalse } from '../utils/storage'
import { isConnected as isFileConnected, getFileName, disconnect as fileDisconnect } from '../utils/fileStorage'
import { isConnected as isTauriConnected, getFilePath as getTauriPath } from '../utils/tauriStorage'
import { autoLoad, refreshSource } from '../utils/dataLoader'
import Icon from './Icon'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../utils/tauriStorage'
import { useApp } from '../utils/AppContext'

const LOCATIONS  = ['IP/OP', 'EC', 'SM']
const ADMIN_PIN  = 'nlthadmin'

const FLAG_LABELS = {
  enableSmallLabel:     'Small Label Print',
  enableReconstitution: 'Reconstitution',
  enableEV54Tools:      'EV54 Tools',
  enableAbxTab:         '· Drug Reconstitution',
  enableExtempTab:      '· Extemporaneous',
  enablePrepackTab:     '· Prepack',
  enablePickListTab:    '· EV54 Pick List',
  enableGtinLabelTab:   '· EV54 GTIN Label',
  enableMaintenance:    'Maintenance page',
  enableSettings:       'Settings page',
}

export default function Settings({ navigate }) {
  // ── All hooks first (no hooks after early returns) ─────────────────────────
  const [unlocked,      setUnlocked]      = useState(false)
  const [pinInput,      setPinInput]      = useState('')
  const [pinError,      setPinError]      = useState(false)
  const [settingsTab,   setSettingsTab]   = useState('general')
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminPin,      setAdminPin]      = useState('')
  const [adminPinError, setAdminPinError] = useState(false)
  const [settings,      _setSettings]    = useState(getSettings)
  const [saved,         setSaved]        = useState(false)
  const [pinForm,       setPinForm]      = useState({ current: '', newPin: '', confirm: '' })
  const [pinMsg,        setPinMsg]       = useState('')
  const [importMsg,     setImportMsg]    = useState('')
  const [dataPaths,     setDataPaths]    = useState(getDataPaths)
  const [refreshMsg,    setRefreshMsg]   = useState('')
  const [refreshingKey, setRefreshingKey] = useState(null)
  const [rowMsg,        setRowMsg]       = useState({})
  const [printers,      setPrinters]     = useState([])
  const [profiles,      setProfiles]     = useState(getComputerProfiles)
  const { computerName, refreshFlags }   = useApp()

  useEffect(() => {
    if (!isTauri()) return
    invoke('list_printers')
      .then(list => { if (Array.isArray(list)) setPrinters(list) })
      .catch(() => {})
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (k, v) => _setSettings(s => ({ ...s, [k]: v }))

  const toggleFlag = (k, v) => {
    saveSettings({ [k]: v })
    _setSettings(s => ({ ...s, [k]: v }))
  }

  const savePathsToDisk = (updated) => saveDataPaths(updated)

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

  const handleSingleRefresh = async (key, label) => {
    setRefreshingKey(key)
    const r = await refreshSource(key, dataPaths[key])
    setRefreshingKey(null)
    const msg = r.loaded
      ? `✓ ${label}: ${r.count ?? 0} rows${r.sourceDate ? ` (G1 ${r.sourceDate})` : ''}`
      : `✗ ${label}: ${r.reason}`
    setRowMsg(m => ({ ...m, [key]: msg }))
    setTimeout(() => setRowMsg(m => ({ ...m, [key]: '' })), 6000)
  }

  const handleRefreshNow = async () => {
    setRefreshMsg('Refreshing…')
    try {
      const result = await autoLoad()
      const loaded = [
        result.phqLoaded         && 'PHQ drugs',
        result.locationLoaded    && 'Locations',
        result.mobileShelfLoaded && 'Mobile Shelf',
        result.ev54DrugsLoaded   && 'EV54 Drugs',
        result.gtinLoaded        && 'GTIN',
        result.stockOnhandLoaded && 'Stock Onhand',
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
    if (pinForm.current !== current.maintenancePin) { setPinMsg('Current PIN is incorrect.'); return }
    if (pinForm.newPin !== pinForm.confirm)          { setPinMsg('New PINs do not match.');    return }
    if (pinForm.newPin.length < 4)                   { setPinMsg('PIN must be at least 4 characters.'); return }
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

  // ── PIN gate (early return — all hooks already declared above) ─────────────
  const handleUnlock = () => {
    const correct = getSettings().maintenancePin || 'NLTH'
    if (pinInput.toUpperCase() === correct.toUpperCase()) {
      setUnlocked(true)
    } else {
      setPinError(true)
      setTimeout(() => setPinError(false), 1500)
    }
  }

  if (!unlocked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 320 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Settings</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Enter your maintenance PIN to access settings.
            </div>
            <motion.div animate={pinError ? { x: [-8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
              <input
                className="form-input"
                type="password"
                placeholder="PIN"
                style={{ textAlign: 'center', letterSpacing: 4, fontSize: 18, marginBottom: 12 }}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                autoFocus
              />
            </motion.div>
            {pinError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>Incorrect PIN</div>}
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleUnlock}>Unlock</button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Admin unlock (safe after early return — not a hook) ────────────────────
  const handleAdminUnlock = () => {
    if (adminPin === ADMIN_PIN) {
      setAdminUnlocked(true)
    } else {
      setAdminPinError(true)
      setTimeout(() => setAdminPinError(false), 1500)
    }
  }

  // ── Profile editing helpers ────────────────────────────────────────────────
  const persistProfiles = (next) => {
    setProfiles(next)
    saveComputerProfiles(next)
    refreshFlags()
  }

  const updateProfileFlag = (name, flag, value) => {
    const next = { ...profiles, [name]: { ...(profiles[name] || allFlagsFalse()), [flag]: value } }
    persistProfiles(next)
  }

  const renameProfile = (oldName, newName) => {
    const trimmed = (newName || '').trim().toUpperCase()
    if (!trimmed || trimmed === oldName) return
    if (profiles[trimmed]) return // refuse to overwrite an existing one
    const next = { ...profiles }
    next[trimmed] = next[oldName]
    delete next[oldName]
    persistProfiles(next)
  }

  const deleteProfile = (name) => {
    if (!window.confirm(`Delete profile for ${name}?`)) return
    const next = { ...profiles }
    delete next[name]
    persistProfiles(next)
  }

  const addProfile = () => {
    const base = (computerName || 'NEW-PC').toUpperCase()
    let candidate = base
    let i = 2
    while (profiles[candidate]) { candidate = `${base}-${i++}` }
    persistProfiles({ ...profiles, [candidate]: allFlagsFalse() })
  }

  const presetAll = (name) => {
    persistProfiles({ ...profiles, [name]: allFlagsTrue() })
  }
  const presetNone = (name) => {
    persistProfiles({ ...profiles, [name]: allFlagsFalse() })
  }

  // ── Admin tab content ──────────────────────────────────────────────────────
  const adminContent = adminUnlocked ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🖥️ Computer Profiles</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
          Each profile controls which functions are visible on a specific PC (matched by Windows COMPUTERNAME).
          Computers without a profile show only Drug Enquiry until a session unlock.
        </div>
        <div style={{
          fontSize: 12, padding: '8px 12px', background: 'var(--bg)',
          borderRadius: 8, marginBottom: 14, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <span>This PC: <code style={{ fontWeight: 700 }}>{computerName || '(unknown)'}</code></span>
          <button className="btn btn-primary btn-sm" onClick={addProfile}>+ Add Profile</button>
        </div>
        {Object.keys(profiles).length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
            No profiles yet. Click "Add Profile" to create one.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(profiles).map(([name, flags]) => {
            const isCurrent = name.toUpperCase() === (computerName || '').toUpperCase()
            return (
              <div
                key={name}
                style={{
                  border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 10, padding: 12, background: isCurrent ? 'var(--primary-light, #eff6ff)' : 'var(--bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <input
                    className="form-input"
                    style={{ flex: '1 1 200px', fontFamily: 'monospace', fontWeight: 700 }}
                    defaultValue={name}
                    onBlur={e => renameProfile(name, e.target.value)}
                  />
                  {isCurrent && (
                    <span className="chip" style={{ background: 'var(--primary)', color: '#fff', fontSize: 11 }}>
                      THIS PC
                    </span>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => presetAll(name)} title="Enable all">All</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => presetNone(name)} title="Disable all">None</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteProfile(name)}>Delete</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {getFeatureFlagList().map(flag => (
                    <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!flags[flag]}
                        onChange={e => updateProfileFlag(name, flag, e.target.checked)}
                      />
                      <span>{FLAG_LABELS[flag] || flag}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 320 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Admin Access</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
            Enter the admin PIN to manage feature flags.
          </div>
          <motion.div animate={adminPinError ? { x: [-8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
            <input
              className="form-input"
              type="password"
              placeholder="Admin PIN"
              style={{ textAlign: 'center', letterSpacing: 4, fontSize: 16, marginBottom: 10 }}
              value={adminPin}
              onChange={e => setAdminPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminUnlock()}
              autoFocus
            />
          </motion.div>
          {adminPinError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>Incorrect PIN</div>}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdminUnlock}>Unlock Admin</button>
        </div>
      </motion.div>
    </div>
  )

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Tab bar */}
      <div className="tabs mb-12" style={{ display: 'inline-flex', width: 'auto' }}>
        <button className={`tab-btn ${settingsTab === 'general' ? 'active' : ''}`} onClick={() => setSettingsTab('general')}>General</button>
        <button className={`tab-btn ${settingsTab === 'admin'   ? 'active' : ''}`} onClick={() => setSettingsTab('admin')}>Admin</button>
      </div>

      {/* Admin tab */}
      {settingsTab === 'admin' && adminContent}

      {/* General tab */}
      {settingsTab === 'general' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save settings'}
            </button>
          </div>

          {/* Data connection status */}
          {(() => {
            const tauriOk = isTauriConnected()
            const fileOk  = isFileConnected()
            const color   = tauriOk ? 'var(--primary)' : fileOk ? 'var(--success)' : 'var(--warning)'
            const icon    = tauriOk ? '💾' : fileOk ? '🗂️' : '💻'
            const title   = tauriOk ? 'Auto-save Active' : fileOk ? 'Shared File Connected' : 'Local Storage Only'
            const detail  = tauriOk
              ? `Every change is written to ${getTauriPath()}`
              : fileOk
                ? `File: ${getFileName()}`
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
                    <button className="btn btn-ghost btn-sm" onClick={handleDisconnect}>Change</button>
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
              { key: 'stockOnhand', label: 'Stock Onhand',    hint: '.xlsx',      filters: [{ name: 'Excel',  extensions: ['xlsx','xls'] }] },
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
                    placeholder={`e.g. D:\\Data\\${hint === '.txt' ? 'PHQ.txt' : hint === '.accdb' ? 'GTIN.accdb' : 'ItemLocation.xls'}`}
                  />
                  {isTauri() && (
                    <button className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}
                      onClick={() => browsePath(key, filters)}>Browse…</button>
                  )}
                  {isTauri() && dataPaths[key] && (
                    <button
                      className="btn btn-ghost btn-sm"
                      title={`Refresh ${label}`}
                      disabled={refreshingKey === key}
                      onClick={() => handleSingleRefresh(key, label)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}
                    >
                      <Icon name="refresh-cw" size={14}
                        style={refreshingKey === key ? { animation: 'spin 0.9s linear infinite' } : undefined} />
                    </button>
                  )}
                </div>
                {rowMsg[key] && (
                  <div style={{
                    fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)',
                    color: rowMsg[key].startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {rowMsg[key]}
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <button className="btn btn-primary btn-sm" onClick={handleRefreshNow}>🔄 Refresh Now</button>
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
                    onClick={() => set('location', loc)}>{loc}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Affects which batch counter is used (EC counter vs IP/OP counter).
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Thermal Printer</label>
              {isTauri() && printers.length > 0 ? (
                <select className="form-select" value={settings.printerName} onChange={e => set('printerName', e.target.value)}>
                  <option value="">— Select a printer —</option>
                  {printers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input className="form-input" value={settings.printerName}
                  onChange={e => set('printerName', e.target.value)}
                  placeholder="e.g. Thermal GX420t - PMS" />
              )}
              {isTauri() && printers.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  No printers detected — enter the name manually.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">PHQ Database Path</label>
              <input className="form-input" value={settings.phqDatabasePath || ''}
                onChange={e => set('phqDatabasePath', e.target.value)}
                placeholder="e.g. \\\\server\\path\\to\\database.mdb" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.showPrintDialog}
                onChange={e => set('showPrintDialog', e.target.checked)} />
              <div>
                <div style={{ fontWeight: 600 }}>Show print dialog</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Shows the OS print dialog before each label. Uncheck to print straight to the default printer.</div>
              </div>
            </label>

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
              cursor: isTauri() ? 'pointer' : 'not-allowed',
              marginTop: 12, padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: settings.silentPrint && isTauri() ? 'var(--primary-light, #eff6ff)' : 'var(--bg)',
              opacity: isTauri() ? 1 : 0.55,
            }}>
              <input type="checkbox" checked={!!settings.silentPrint}
                onChange={e => set('silentPrint', e.target.checked)}
                disabled={!isTauri()} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600 }}>
                  🖨️ Silent print (PowerShell + System.Drawing)
                  {!isTauri() && (
                    <span style={{ fontSize: 11, color: 'var(--warning)', marginLeft: 8, fontWeight: 500 }}>Desktop app only</span>
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
                { value: 'gs1',    label: 'GS1 AI Parser',  desc: 'Recommended — reads Application Identifiers (01)(10)(17) in any order. Works with QR, Data Matrix, and GS1-128.' },
                { value: 'legacy', label: 'Legacy (P0–P6)', desc: 'Original positional patterns. Use if your scanner outputs a non-standard format that the GS1 parser cannot handle.' },
              ].map(opt => (
                <label key={opt.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
                  cursor: 'pointer', flex: 1, minWidth: 200,
                  padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: settings.barcodeMethod === opt.value ? 'var(--primary-light, #eff6ff)' : 'var(--bg)',
                }}>
                  <input type="radio" name="barcodeMethod" value={opt.value}
                    checked={settings.barcodeMethod === opt.value}
                    onChange={() => set('barcodeMethod', opt.value)}
                    style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Label Dimensions & Typography */}
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
                <input className="form-input" type="number" step="0.1" value={settings.labelPadTop ?? 0}
                  onChange={e => set('labelPadTop', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Pad Bottom (mm)</label>
                <input className="form-input" type="number" step="0.1" value={settings.labelPadBottom ?? 0}
                  onChange={e => set('labelPadBottom', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Pad Left (mm)</label>
                <input className="form-input" type="number" step="0.1" value={settings.labelPadLeft ?? 0}
                  onChange={e => set('labelPadLeft', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Pad Right (mm)</label>
                <input className="form-input" type="number" step="0.1" value={settings.labelPadRight ?? 0}
                  onChange={e => set('labelPadRight', parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Drug Name Size (pt)</label>
                <input className="form-input" type="number" step="0.5" value={settings.drugFontSize ?? 6}
                  onChange={e => set('drugFontSize', parseFloat(e.target.value) || 6)} />
              </div>
              <div className="form-group">
                <label className="form-label">Batch No. Size (pt)</label>
                <input className="form-input" type="number" step="0.5" value={settings.batchFontSize ?? 5}
                  onChange={e => set('batchFontSize', parseFloat(e.target.value) || 5)} />
              </div>
              <div className="form-group">
                <label className="form-label">Signature Size (pt)</label>
                <input className="form-input" type="number" step="0.5" value={settings.signFontSize ?? 5}
                  onChange={e => set('signFontSize', parseFloat(e.target.value) || 5)} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
              <input type="checkbox" checked={settings.drugFontBold !== false}
                onChange={e => set('drugFontBold', e.target.checked)} />
              <span>Bold drug name</span>
            </label>

            <div style={{ marginTop: 16, fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
              Drug Reconstitution Label
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
              <div className="form-group">
                <label className="form-label">Recon Title Size (pt)</label>
                <input className="form-input" type="number" step="0.5" value={settings.reconTitleFontSize ?? 6}
                  onChange={e => set('reconTitleFontSize', parseFloat(e.target.value) || 6)} />
              </div>
              <div className="form-group">
                <label className="form-label">Recon Value Size (pt)</label>
                <input className="form-input" type="number" step="0.5" value={settings.reconValueFontSize ?? 9}
                  onChange={e => set('reconValueFontSize', parseFloat(e.target.value) || 9)} />
              </div>
            </div>

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              Default: 34.4 × 25 mm · Arial · Drug 6pt bold · Batch 5pt · Sign 5pt · Recon 6/9pt · No padding
            </div>
          </div>

          {/* GTIN QR Label */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🏷 GTIN QR Label</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">
                  QR Code Size (mm) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(0 = auto)</span>
                </label>
                <input className="form-input" type="number" step="0.5" min="0"
                  value={settings.gtinQrSizeMm ?? 0}
                  onChange={e => set('gtinQrSizeMm', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Item Code Font Size (pt)</label>
                <input className="form-input" type="number" step="0.5" min="3"
                  value={settings.gtinItemCodeFontSize ?? 5}
                  onChange={e => set('gtinItemCodeFontSize', parseFloat(e.target.value) || 5)} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Default: QR fills the label automatically · Item code 5pt Arial
            </div>
          </div>

          {/* Change PIN */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔒 Change Maintenance PIN</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Current PIN</label>
                <input className="form-input" type="password" value={pinForm.current}
                  onChange={e => setPinForm(f => ({ ...f, current: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">New PIN</label>
                <input className="form-input" type="password" value={pinForm.newPin}
                  onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New PIN</label>
                <input className="form-input" type="password" value={pinForm.confirm}
                  onChange={e => setPinForm(f => ({ ...f, confirm: e.target.value }))} />
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
        </>
      )}
    </div>
  )
}
