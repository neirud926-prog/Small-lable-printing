import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { getDrugs } from '../utils/storage'
import { getSettings } from '../utils/storage'

const NAV_CARDS = [
  {
    id: 'smalllabel',
    title: 'Small Label Print',
    icon: '🏷️',
    desc: 'Scan barcode or enter item code to print IP/OP drug labels',
    color: '#1a73e8',
    bg: '#e8f0fe',
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation',
    icon: '💊',
    desc: 'ABX preparation, extemporaneous & prepack label generation',
    color: '#34a853',
    bg: '#e6f4ea',
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    icon: '🔧',
    desc: 'Product data, expiry rules, batch history (PIN required)',
    color: '#ea4335',
    bg: '#fce8e6',
  },
]

const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.08 },
  },
}
const cardVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

export default function MainMenu({ navigate }) {
  const [enquiry, setEnquiry] = useState('')
  const [results, setResults] = useState([])
  const settings = getSettings()

  const handleEnquiry = (val) => {
    setEnquiry(val)
    if (val.length >= 4) {
      const drugs = getDrugs()
      const q = val.toUpperCase()
      const found = drugs.filter(
        d => d.itemCode.toUpperCase().includes(q) || d.name.toUpperCase().includes(q)
      ).slice(0, 10)
      setResults(found)
    } else {
      setResults([])
    }
  }

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>NLTH PHARMACY</div>
          <h1 style={{ fontSize: 20 }}>Small Label System</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)' }}>
            📍 {settings.location}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('settings')} title="Settings">
            ⚙️
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Drug Enquiry */}
        <div className="card mb-12">
          <div className="form-label mb-8">🔍 Drug Enquiry</div>
          <input
            className="form-input"
            placeholder="Enter item code or drug name (min 4 chars)…"
            value={enquiry}
            onChange={e => handleEnquiry(e.target.value)}
            autoComplete="off"
          />
          {results.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {results.map(d => (
                <div key={d.id || d.itemCode} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{d.itemCode}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, flex: 1, textAlign: 'left', marginLeft: 16 }}>{d.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.unit}</span>
                </div>
              ))}
            </div>
          )}
          {enquiry.length >= 4 && results.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No drugs found matching "{enquiry}"</div>
          )}
        </div>

        {/* Nav Cards */}
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {NAV_CARDS.map(card => (
            <motion.div
              key={card.id}
              variants={cardVariants}
              whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(card.id)}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: card.bg, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>
                {card.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: card.color }}>{card.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{card.desc}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32, color: 'var(--text-muted)', fontSize: 12 }}>
          Small Label Printing System · Offline Mode
        </div>
      </div>
    </div>
  )
}
