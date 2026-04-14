import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { pickExisting, createNew } from '../utils/fileStorage'

export default function FileConnect({ onConnected }) {
  const [status, setStatus] = useState('')   // '' | 'loading' | 'error'
  const [error,  setError]  = useState('')

  async function handleFile(action) {
    setStatus('loading'); setError('')
    try {
      if (action === 'open')   await pickExisting()
      if (action === 'create') await createNew()
      onConnected()
    } catch (e) {
      if (e.name === 'AbortError') { setStatus(''); return }
      setError(e.message || 'Could not open file.')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 480, width: '100%' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🗂️</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            Small Label Printing
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
            You're running in browser mode. Pick a JSON data file to continue —
            or install the desktop app for automatic disk persistence.
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>📂</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Open Shared Data File</div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Pick a <code style={{ fontSize: 12 }}>small-label-data.json</code> file on disk or a network drive.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={status === 'loading'}
              onClick={() => handleFile('open')}
            >
              📂 Open Existing File
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              disabled={status === 'loading'}
              onClick={() => handleFile('create')}
            >
              ✨ Create New File
            </button>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 6,
              background: 'rgba(244,67,54,0.1)', color: 'var(--danger)',
              borderLeft: '4px solid var(--danger)', fontSize: 13,
            }}
          >
            {error}
          </motion.div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--text-muted)', fontSize: 12 }}
            onClick={onConnected}
          >
            Use this PC only (browser storage)
          </button>
        </div>
      </motion.div>
    </div>
  )
}
