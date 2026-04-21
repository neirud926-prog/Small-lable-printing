import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from './components/AppShell'
import DrugEnquiry from './components/DrugEnquiry'
import SmallLabelPrint from './components/SmallLabelPrint'
import Reconstitution from './components/Reconstitution/index'
import Maintenance from './components/Maintenance/index'
import EV54Tools from './components/EV54Tools/index'
import Settings from './components/Settings'
import FileConnect from './components/FileConnect'
import { tryRestore, onRemoteChange, hasStoredHandle, pickExisting } from './utils/fileStorage'
import { init as initTauri, isTauri }                       from './utils/tauriStorage'
import { autoLoad }                                          from './utils/dataLoader'

const pageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -40, transition: { duration: 0.2, ease: 'easeIn' } },
}

export default function App() {
  const [view,        setView]        = useState('enquiry')
  const [connected,   setConnected]   = useState(false)
  const [loading,     setLoading]     = useState(true)    // while tryRestore() runs
  const [remoteAlert, setRemoteAlert] = useState(false)   // another PC changed data
  const [needReconnect, setNeedReconnect] = useState(false) // had file, lost permission
  const [printError,  setPrintError]  = useState(null)    // silent print failure message
  const [globalSearch, setGlobalSearch] = useState('')

  // On mount: auto-connect using the best available storage
  useEffect(() => {
    async function init() {
      // 1. Native app — Tauri reads/writes D:\SmallLabel\small-label-data.json directly
      if (isTauri()) {
        try {
          if (await initTauri()) {
            await autoLoad()    // refresh drugs / locations / GTIN from configured paths
            setConnected(true); setLoading(false); return
          }
        } catch (e) {
          console.error('Tauri storage init failed:', e)
        }
      }

      // 2. Browser fallback — previously-picked shared file (File System Access API)
      if (await tryRestore()) { setConnected(true); setLoading(false); return }

      // 3. Had a file before but lost permission — minimal reconnect prompt
      if (hasStoredHandle()) { setNeedReconnect(true); setLoading(false); return }

      // 4. Nothing found — show the connect screen
      setLoading(false)
    }
    init()
  }, [])

  // Wire up remote-change banner for file-picker mode (Tauri mode has no remote sync).
  useEffect(() => {
    onRemoteChange(() => setRemoteAlert(true))
  }, [])

  // Listen for silent-print errors dispatched by labelPrint.js
  useEffect(() => {
    const handler = (e) => setPrintError(e.detail)
    window.addEventListener('sml:print-error', handler)
    return () => window.removeEventListener('sml:print-error', handler)
  }, [])

  const navigate = (page) => setView(page)

  const handleGlobalSearch = (q) => {
    setGlobalSearch(q)
    setView('enquiry')
  }

  // Global keyboard shortcuts: ⌘K/Ctrl+K → focus topbar search; F1-F3 → navigate
  useEffect(() => {
    const handler = (e) => {
      // Don't fire inside <input>, <textarea>, <select>
      const tag = document.activeElement?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('sml:focus-search'))
        return
      }
      if (!inField) {
        if (e.key === 'F1') { e.preventDefault(); setView('smalllabel') }
        if (e.key === 'F2') { e.preventDefault(); setView('reconstitution') }
        if (e.key === 'F3') { e.preventDefault(); setView('ev54tools') }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)',
      }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          Connecting to data file…
        </div>
      </div>
    )
  }

  // ── Minimal reconnect prompt (had file, lost permission) ─────────────────
  if (needReconnect) {
    const storedName = localStorage.getItem('sml_connectedFileName') || 'your data file'
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)', padding: 24,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Permission Required</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            Chrome needs permission to access your data file:<br />
            <strong style={{ color: 'var(--text)' }}>{storedName}</strong><br />
            Click below to grant access — this takes one click.
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: 15, padding: '12px 32px', marginBottom: 12 }}
            onClick={async () => {
              try {
                await pickExisting()
                setNeedReconnect(false)
                setConnected(true)
              } catch (e) {
                if (e.name !== 'AbortError') {
                  setNeedReconnect(false)
                }
              }
            }}
          >
            📂 Reconnect to File
          </button>
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--text-muted)', fontSize: 12 }}
              onClick={() => { setNeedReconnect(false) }}
            >
              Use local storage only
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── File picker screen (first run or after disconnect) ─────────────────────
  if (!connected) {
    return <FileConnect onConnected={() => setConnected(true)} />
  }

  // ── Main app (AppShell wraps all destinations) ─────────────────────────────
  const renderView = () => {
    switch (view) {
      case 'enquiry':        return <DrugEnquiry      navigate={navigate} key="enquiry" initialQuery={globalSearch} />
      case 'smalllabel':     return <SmallLabelPrint  navigate={navigate} key="smalllabel" />
      case 'reconstitution': return <Reconstitution   navigate={navigate} key="reconstitution" />
      case 'maintenance':    return <Maintenance      navigate={navigate} key="maintenance" />
      case 'ev54tools':      return <EV54Tools        navigate={navigate} key="ev54tools" />
      case 'settings':       return <Settings         navigate={navigate} key="settings" />
      default:               return <DrugEnquiry      navigate={navigate} key="enquiry" />
    }
  }

  return (
    <AppShell view={view} onNav={navigate} onGlobalSearch={handleGlobalSearch}>
      {/* Silent-print error banner */}
      <AnimatePresence>
        {printError && (
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: -12, opacity: 0 }}
            style={{
              marginBottom: 14,
              background: 'var(--danger-bg)', color: 'var(--danger)',
              padding: '10px 14px', borderRadius: 10, border: '1px solid var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 13, gap: 12,
            }}
          >
            <span>Print error: {printError}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setPrintError(null)}>Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remote-change notification banner */}
      <AnimatePresence>
        {remoteAlert && (
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: -12, opacity: 0 }}
            style={{
              marginBottom: 14,
              background: 'var(--info-bg)', color: 'var(--info)',
              padding: '10px 14px', borderRadius: 10, border: '1px solid var(--info)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 13, gap: 12,
            }}
          >
            <span>Data was updated by another PC.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={() => window.location.reload()}>Reload now</button>
              <button className="btn btn-sm btn-ghost"   onClick={() => setRemoteAlert(false)}>Dismiss</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}
