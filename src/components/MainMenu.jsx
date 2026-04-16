import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getDrugs, getItemLocation } from '../utils/storage'
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
    id: 'ev54tools',
    title: 'EV54 Tools',
    icon: '🤖',
    desc: 'Pick list generation for EV54 machine refill',
    color: '#9333ea',
    bg: '#f3e8ff',
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
  const [enquiry, setEnquiry]   = useState('')
  const [results, setResults]   = useState([])
  const [selected, setSelected] = useState(null)
  const settings = getSettings()

  const showSuggestions = (drugs, q) => {
    const up = q.toUpperCase()
    const found = drugs.filter(
      d => d.itemCode.toUpperCase().startsWith(up) || d.name.toUpperCase().includes(up)
    ).slice(0, 10)
    setResults(found)
  }

  const handleEnquiry = (val) => {
    setEnquiry(val)
    setSelected(null)
    const v = val.trim()
    if (v.length === 0) {
      setResults([])
      return
    }
    const drugs = getDrugs()
    if (v.length === 6) {
      const exact = drugs.find(d => d.itemCode.toUpperCase() === v.toUpperCase())
      if (exact) {
        setSelected(exact)
        setResults([])
        return
      }
    }
    if (v.length >= 4) {
      showSuggestions(drugs, v)
    } else {
      setResults([])
    }
  }

  const selectDrug = (drug) => {
    setSelected(drug)
    setResults([])
    setEnquiry(drug.itemCode)
  }

  const clearEnquiry = () => {
    setEnquiry('')
    setResults([])
    setSelected(null)
  }

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>NLTH PHARMACY</div>
          <h1 style={{ fontSize: 20 }}>NLTH RxStation</h1>
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
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              placeholder="Enter item code or drug name (min 4 chars)…"
              value={enquiry}
              onChange={e => handleEnquiry(e.target.value)}
              autoComplete="off"
              style={{ paddingRight: enquiry ? 36 : undefined }}
            />
            {enquiry && (
              <button
                onClick={clearEnquiry}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
                }}
                title="Clear"
              >×</button>
            )}
          </div>

          {/* Suggestions */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}
              >
                {results.map(d => {
                  const loc = getItemLocation(d.itemCode)
                  return (
                    <div
                      key={d.id || d.itemCode}
                      onClick={() => selectDrug(d)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 12px', borderBottom: '1px solid var(--border)',
                        background: 'var(--surface)', cursor: 'pointer', gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                    >
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', flexShrink: 0 }}>{d.itemCode}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, flex: 1, marginLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      {loc && <span style={{ fontSize: 11, color: 'var(--primary)', background: '#e8f0fe', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>📍 {loc}</span>}
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{d.unit}</span>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detail card for selected drug */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginTop: 10, padding: '14px 16px',
                  border: '1.5px solid var(--primary)', borderRadius: 'var(--radius)',
                  background: '#f0f6ff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{selected.itemCode}</div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{selected.name}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {selected.unit && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unit: <strong>{selected.unit}</strong></span>
                      )}
                      {(() => {
                        const loc = getItemLocation(selected.itemCode)
                        return loc ? (
                          <span style={{ fontSize: 12, background: '#e8f0fe', color: 'var(--primary)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                            📍 {loc}
                          </span>
                        ) : null
                      })()}
                      {selected.isSpecial && (
                        <span className="badge badge-warning">⚠ Special</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {enquiry.length >= 4 && results.length === 0 && !selected && (
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
