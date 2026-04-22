import React, { useState } from 'react'

const UNLOCK_PIN = 'nlthadmin'

export default function UnlockDialog({ open, onClose, onUnlock }) {
  const [pin, setPin]     = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  function submit(e) {
    e.preventDefault()
    if (pin.trim().toLowerCase() === UNLOCK_PIN) {
      setPin('')
      setError('')
      onUnlock()
      onClose()
    } else {
      setError('Incorrect PIN')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', padding: 24, borderRadius: 14,
          minWidth: 320, maxWidth: 400, boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Developer / Admin Unlock</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Enter the admin PIN to unlock all functions for this session.
          The unlock resets when the app is closed.
        </div>
        <input
          type="password"
          autoFocus
          className="form-input"
          placeholder="Admin PIN"
          value={pin}
          onChange={e => { setPin(e.target.value); setError('') }}
          style={{ width: '100%', marginBottom: 8 }}
        />
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Unlock</button>
        </div>
      </form>
    </div>
  )
}
