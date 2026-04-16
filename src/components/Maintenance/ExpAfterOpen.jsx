import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getExpAfterOpen, saveExpAfterOpen, getDrugs, findDrugByCode } from '../../utils/storage'

const SEED = [
  { itemCode: 'PRED29', days: 28 },
  { itemCode: 'VALP03', days: 80 },
  { itemCode: 'TENO09', days: 30 },
  { itemCode: 'TACR05', days: 365 },
  { itemCode: 'TACR06', days: 365 },
  { itemCode: 'TACR08', days: 365 },
  { itemCode: 'TACR15', days: 365 },
  { itemCode: 'TACR16', days: 365 },
  { itemCode: 'AUGM01', days: 30 },
]

function ensureSeeded() {
  const existing = getExpAfterOpen()
  if (existing.length > 0) return existing
  const seeded = SEED.map(s => ({ ...s, id: s.itemCode }))
  saveExpAfterOpen(seeded)
  return seeded
}

export default function ExpAfterOpen({ navigate }) {
  const [rows,    setRows]    = useState(ensureSeeded)
  const [search,  setSearch]  = useState('')
  const [newCode, setNewCode] = useState('')
  const [newDays, setNewDays] = useState('')
  const [addErr,  setAddErr]  = useState('')

  const save = (updated) => { setRows(updated); saveExpAfterOpen(updated) }

  const handleUpdateDays = (id, val) => {
    const updated = rows.map(r => r.id === id ? { ...r, days: parseInt(val, 10) || '' } : r)
    save(updated)
  }

  const handleDelete = (id) => {
    save(rows.filter(r => r.id !== id))
  }

  const handleAdd = () => {
    setAddErr('')
    const code = newCode.trim().toUpperCase()
    if (!code) { setAddErr('Item code is required.'); return }
    if (!newDays || isNaN(parseInt(newDays, 10))) { setAddErr('Days must be a number.'); return }
    if (rows.find(r => r.id === code)) { setAddErr(`${code} already exists.`); return }
    const drug = findDrugByCode(code)
    save([...rows, { id: code, itemCode: code, days: parseInt(newDays, 10), _name: drug?.name || '' }])
    setNewCode(''); setNewDays('')
  }

  const getDrugName = (row) => {
    if (row._name) return row._name
    return findDrugByCode(row.itemCode)?.name || '—'
  }

  const filtered = rows.filter(r =>
    r.itemCode.includes(search.toUpperCase()) ||
    getDrugName(r).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-back" onClick={() => navigate('maintenance')}>‹</button>
        <h1>Short Exp After Opening</h1>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Info */}
        <div className="card" style={{ borderLeft: '4px solid var(--primary)', padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
          Days until expiry after a vial/bottle is first opened. Used when printing short-expiry labels for reconstituted products.
        </div>

        {/* Add row */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Add Entry</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ width: 130, fontFamily: 'monospace' }}
              placeholder="Item Code"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="form-input"
              style={{ width: 100 }}
              placeholder="Days"
              type="number"
              min="1"
              value={newDays}
              onChange={e => setNewDays(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>+ Add</button>
          </div>
          {addErr && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{addErr}</div>}
        </div>

        {/* Search + table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{rows.length} entries</div>
            <input
              className="form-input"
              style={{ width: 220, fontSize: 13 }}
              placeholder="Search code or name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', width: 110 }}>Item Code</th>
                <th style={{ padding: '6px 8px' }}>Drug Name</th>
                <th style={{ padding: '6px 8px', width: 100, textAlign: 'center' }}>Days</th>
                <th style={{ padding: '6px 8px', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map(row => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontWeight: 600 }}>{row.itemCode}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{getDrugName(row)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      <input
                        className="form-input"
                        style={{ width: 72, textAlign: 'center', fontSize: 13 }}
                        type="number"
                        min="1"
                        value={row.days}
                        onChange={e => handleUpdateDays(row.id, e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)', fontSize: 16, padding: '0 6px' }}
                        onClick={() => handleDelete(row.id)}
                        title="Remove"
                      >×</button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
              No entries found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
