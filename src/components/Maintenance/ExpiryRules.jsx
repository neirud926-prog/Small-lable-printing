import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getExpiryRules, saveExpiryRules } from '../../utils/storage'

const EMPTY = { itemCode: '', manufacturer: '', shelfLifeValue: '', shelfLifeUnit: 'Days', storage: '', warning: '', note: '', status: 'Active' }

export default function ExpiryRules() {
  const [rules, setRules]   = useState(getExpiryRules)
  const [modal, setModal]   = useState(null)
  const [search, setSearch] = useState('')
  const [delId, setDelId]   = useState(null)

  const filtered = rules.filter(r => {
    const q = search.toUpperCase()
    return r.itemCode.toUpperCase().includes(q) || r.manufacturer.toUpperCase().includes(q)
  })

  const handleSave = (form) => {
    let updated
    if (modal.mode === 'add') {
      updated = [...rules, { ...form, id: Date.now().toString() }]
    } else {
      updated = rules.map(r => r.id === modal.item.id ? { ...r, ...form } : r)
    }
    saveExpiryRules(updated)
    setRules(updated)
    setModal(null)
  }

  const toggleStatus = (id) => {
    const updated = rules.map(r => r.id === id ? { ...r, status: r.status === 'Active' ? 'Suspended' : 'Active' } : r)
    saveExpiryRules(updated)
    setRules(updated)
  }

  const handleDelete = (id) => {
    const updated = rules.filter(r => r.id !== id)
    saveExpiryRules(updated)
    setRules(updated)
    setDelId(null)
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input className="form-input" placeholder="Search item code or manufacturer…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'add', item: { ...EMPTY } })}>+ Add Rule</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">No expiry rules. Add rules to enable expiry calculations in Reconstitution.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Manufacturer</th>
                  <th>Shelf Life</th>
                  <th>Storage</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td><code style={{ fontFamily: 'monospace' }}>{r.itemCode}</code></td>
                    <td style={{ fontSize: 13 }}>{r.manufacturer}</td>
                    <td style={{ fontSize: 13 }}>{r.shelfLifeValue} {r.shelfLifeUnit}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.storage || '—'}</td>
                    <td>
                      <button
                        className={`badge ${r.status === 'Active' ? 'badge-success' : 'badge-danger'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => toggleStatus(r.id)}
                      >
                        {r.status}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: 'edit', item: r })}>✏</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(r.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ maxWidth: 520 }}>
              <div className="modal-title">{modal.mode === 'add' ? 'Add' : 'Edit'} Expiry Rule</div>
              <ExpiryRuleForm initial={modal.item} onSave={handleSave} onCancel={() => setModal(null)} />
            </motion.div>
          </motion.div>
        )}
        {delId && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ scale: 0.85 }} animate={{ scale: 1 }} style={{ maxWidth: 320, textAlign: 'center' }}>
              <div className="modal-title">Delete Rule?</div>
              <div className="modal-footer" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setDelId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(delId)}>Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExpiryRuleForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Item Code</label>
          <input className="form-input" value={form.itemCode} onChange={e => set('itemCode', e.target.value.toUpperCase())} placeholder="e.g. AUGM06" />
        </div>
        <div className="form-group">
          <label className="form-label">Manufacturer</label>
          <input className="form-input" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. GSK" />
        </div>
        <div className="form-group">
          <label className="form-label">Shelf Life Value</label>
          <input className="form-input" type="number" value={form.shelfLifeValue} onChange={e => set('shelfLifeValue', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Shelf Life Unit</label>
          <select className="form-select" value={form.shelfLifeUnit} onChange={e => set('shelfLifeUnit', e.target.value)}>
            <option value="Days">Days</option>
            <option value="Month">Month</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Storage Condition</label>
          <input className="form-input" value={form.storage} onChange={e => set('storage', e.target.value)} placeholder="e.g. Store below 25°C" />
        </div>
        <div className="form-group">
          <label className="form-label">Warning</label>
          <input className="form-input" value={form.warning} onChange={e => set('warning', e.target.value)} placeholder="Optional warning text" />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}>Save</button>
      </div>
    </div>
  )
}
