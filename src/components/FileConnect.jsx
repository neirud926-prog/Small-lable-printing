import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { pickExisting, createNew } from '../utils/fileStorage'

export default function FileConnect({ onConnected }) {
  const [status, setStatus] = useState('') // '' | 'loading' | 'error'
  const [error,  setError]  = useState('')

  async function handle(action) {
    setStatus('loading')
    setError('')
    try {
      if (action === 'open')   await pickExisting()
      if (action === 'create') await createNew()
      onConnected()
    } catch (e) {
      // User cancelled the picker — not an error worth showing
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
        style={{ maxWidth: 460, width: '100%' }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂️</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Small Label Printing
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            This app stores data in a shared JSON file on your network drive,
            so all PCs see the same database.
          </div>
        </div>

        {/* Open existing */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            Open shared data file
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
            Select the existing <code style={{ fontSize: 12 }}>small-label-data.json</code> on
            your network drive. All PCs should point to the same file.
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={status === 'loading'}
            onClick={() => handle('open')}
          >
            {status === 'loading' ? 'Opening…' : '📂 Open Data File'}
          </button>
        </div>

        {/* Create new */}
        <div className="card" style={{ marginBottom: 12, opacity: 0.85 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            Create new data file
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
            First-time setup only. Save to the shared network drive, then other
            PCs can open the same file.
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%' }}
            disabled={status === 'loading'}
            onClick={() => handle('create')}
          >
            ✨ Create New Data File
          </button>
        </div>

        {/* Error */}
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

        {/* Note */}
        <div style={{
          marginTop: 20, fontSize: 12, color: 'var(--text-muted)',
          textAlign: 'center', lineHeight: 1.6,
        }}>
          Chrome will remember your file choice. You won't need to pick it again
          on your next visit — unless you clear your browser data.
        </div>
      </motion.div>
    </div>
  )
}
