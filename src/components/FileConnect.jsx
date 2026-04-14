import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { pickExisting, createNew } from '../utils/fileStorage'
import { tryConnect as tryServerConnect } from '../utils/serverStorage'

export default function FileConnect({ onConnected }) {
  const [serverUrl, setServerUrl] = useState('http://localhost:3000')
  const [status,    setStatus]    = useState('')   // '' | 'loading' | 'error'
  const [error,     setError]     = useState('')

  async function handleServer() {
    if (!serverUrl.trim()) return
    setStatus('loading'); setError('')
    const ok = await tryServerConnect(serverUrl.trim())
    if (ok) { onConnected(); return }
    setError('Could not reach the server. Make sure START-SERVER.bat is running on the target PC.')
    setStatus('error')
  }

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
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🗂️</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            Small Label Printing
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
            Choose how this PC stores its data.
          </div>
        </div>

        {/* ── Option 1: Server (recommended) ─────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🖥️</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Connect to Data Server</div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px',
              background: 'var(--primary)', color: '#fff', borderRadius: 99,
            }}>RECOMMENDED</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Run <strong>START-SERVER.bat</strong> on one PC, then all PCs connect to it.
            Auto-reconnects on every reload — no prompts.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              onKeyDown={e => e.key === 'Enter' && handleServer()}
            />
            <button
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap' }}
              disabled={status === 'loading'}
              onClick={handleServer}
            >
              {status === 'loading' ? 'Connecting…' : 'Connect →'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Same PC: <code>http://localhost:3000</code> &nbsp;·&nbsp;
            Other PC: <code>http://&lt;server-IP&gt;:3000</code>
          </div>
        </div>

        {/* ── Option 2: Shared file ───────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 12, opacity: 0.9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>📂</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Open Shared Data File</div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Pick a <code style={{ fontSize: 12 }}>small-label-data.json</code> on a network drive.
            All PCs must point to the same file. Chrome may ask for permission each session.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost"
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

        {/* Local only */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--text-muted)', fontSize: 12 }}
            onClick={onConnected}
          >
            Use this PC only (no network sharing)
          </button>
        </div>
      </motion.div>
    </div>
  )
}
