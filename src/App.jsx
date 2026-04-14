import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MainMenu from './components/MainMenu'
import SmallLabelPrint from './components/SmallLabelPrint'
import Reconciliation from './components/Reconciliation/index'
import Maintenance from './components/Maintenance/index'
import Settings from './components/Settings'
import FileConnect from './components/FileConnect'
import { tryRestore, onRemoteChange }                        from './utils/fileStorage'
import { tryRestore as tryServerRestore, tryConnect as tryServerConnect,
         onRemoteChange as onServerRemoteChange }             from './utils/serverStorage'

const pageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -40, transition: { duration: 0.2, ease: 'easeIn' } },
}

export default function App() {
  const [view,        setView]        = useState('menu')
  const [connected,   setConnected]   = useState(false)
  const [loading,     setLoading]     = useState(true)    // while tryRestore() runs
  const [remoteAlert, setRemoteAlert] = useState(false)   // another PC changed data

  // On mount: auto-connect using the best available storage
  useEffect(() => {
    async function init() {
      // 1. Try previously-saved server URL
      if (await tryServerRestore()) { setConnected(true); setLoading(false); return }

      // 2. Try same-origin server (app opened via http://localhost:3000 or LAN IP)
      const origin = window.location.origin
      if (origin.startsWith('http')) {
        if (await tryServerConnect(origin)) { setConnected(true); setLoading(false); return }
      }

      // 3. Try previously-picked shared file (File System Access API)
      if (await tryRestore()) { setConnected(true); setLoading(false); return }

      // 4. Nothing found — show the connect screen
      setLoading(false)
    }
    init()
  }, [])

  // Wire up remote-change banners for both storage modes
  useEffect(() => {
    onRemoteChange(() => setRemoteAlert(true))
    onServerRemoteChange(() => setRemoteAlert(true))
  }, [])

  const navigate = (page) => setView(page)

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

  // ── File picker screen (first run or after disconnect) ─────────────────────
  if (!connected) {
    return <FileConnect onConnected={() => setConnected(true)} />
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  const renderView = () => {
    switch (view) {
      case 'menu':           return <MainMenu       navigate={navigate} key="menu" />
      case 'smalllabel':     return <SmallLabelPrint navigate={navigate} key="smalllabel" />
      case 'reconciliation': return <Reconciliation  navigate={navigate} key="reconciliation" />
      case 'maintenance':    return <Maintenance     navigate={navigate} key="maintenance" />
      case 'settings':       return <Settings        navigate={navigate} key="settings" />
      default:               return <MainMenu       navigate={navigate} key="menu" />
    }
  }

  return (
    <div className="app-shell">

      {/* Remote-change notification banner */}
      <AnimatePresence>
        {remoteAlert && (
          <motion.div
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: -48, opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: 'var(--primary)', color: '#fff',
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 13, gap: 12,
            }}
          >
            <span>🔄 Data was updated by another PC.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
                onClick={() => window.location.reload()}
              >
                Reload now
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none' }}
                onClick={() => setRemoteAlert(false)}
              >
                Dismiss
              </button>
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
          style={{ width: '100%', minHeight: '100vh' }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
