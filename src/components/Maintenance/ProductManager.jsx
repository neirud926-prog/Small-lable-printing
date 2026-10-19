import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getDrugs, saveDrugs, getAbxList, saveAbxList,
  getPrepackList, savePrepackList, getExtempList, saveExtempList,
  getExpAfterOpen, saveExpAfterOpen, getItemDescription,
} from '../../utils/storage'

const TYPES = ['Drug (PHQ)', 'ABX', 'Prepack', 'Extemp', 'Exp After Open']

function buildEmpty(type) {
  switch (type) {
    case 'Drug (PHQ)':    return { itemCode: '', name: '', unit: '', isSpecial: false }
    case 'ABX':           return { itemCode: '', prefix: '', packSize: '' }
    case 'Prepack':       return { drugCode: '', prefix: '', unit: '' }
    case 'Extemp':        return { itemCode: '', prefix: '', volume: '' }
    case 'Exp After Open': return { itemCode: '', days: '' }
    default:              return {}
  }
}

function getList(type) {
  switch (type) {
    case 'Drug (PHQ)':    return getDrugs()
    case 'ABX':           return getAbxList()
    case 'Prepack':       return getPrepackList()
    case 'Extemp':        return getExtempList()
    case 'Exp After Open': return getExpAfterOpen()
    default:              return []
  }
}

function saveList(type, list) {
  switch (type) {
    case 'Drug (PHQ)':    saveDrugs(list); break
    case 'ABX':           saveAbxList(list); break
    case 'Prepack':       savePrepackList(list); break
    case 'Extemp':        saveExtempList(list); break
    case 'Exp After Open': saveExpAfterOpen(list); break
  }
}

function getCodeField(type) {
  return type === 'Prepack' ? 'drugCode' : 'itemCode'
}

// Descriptions always come from the item list (Drug (PHQ)); the ABX / Prepack /
// Extemp / Exp After Open tables only hold the code and their own settings.
function descriptionFor(type, item) {
  if (type === 'Drug (PHQ)') return { text: item.name || '', found: true }
  const d = getItemDescription(item[getCodeField(type)])
  return { text: d.found ? d.description : '', found: d.found }
}

function DescriptionCell({ type, item }) {
  const d = descriptionFor(type, item)
  if (d.text) return d.text
  if (!d.found && item[getCodeField(type)]) {
    return <span style={{ color: 'var(--warning)' }}>⚠ Not in item list</span>
  }
  return '—'
}

function ItemForm({ type, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fields = {
    'Drug (PHQ)':    [['itemCode','Item Code'], ['name','Drug Name'], ['unit','Unit'], ['isSpecial','Is Special (AUGM06 style)', 'check']],
    'ABX':           [['itemCode','Item Code'], ['prefix','Prefix'], ['packSize','Pack Size']],
    'Prepack':       [['drugCode','Drug Code'], ['prefix','Prefix'], ['unit','Unit']],
    'Extemp':        [['itemCode','Item Code'], ['prefix','Prefix'], ['volume','Volume']],
    'Exp After Open': [['itemCode','Item Code'], ['days','Days After Opening', 'number']],
  }[type] || []

  return (
    <div>
      {fields.map(([key, label, inputType]) => (
        <div className="form-group" key={key}>
          <label className="form-label">{label}</label>
          {inputType === 'check' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)} />
              <span style={{ fontSize: 13 }}>Yes (black background label)</span>
            </label>
          ) : (
            <input
              className="form-input"
              type={inputType || 'text'}
              value={form[key] || ''}
              onChange={e => set(key, e.target.value)}
              placeholder={label}
            />
          )}
        </div>
      ))}
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}>Save</button>
      </div>
    </div>
  )
}

export default function ProductManager() {
  const [type, setType]     = useState(TYPES[0])
  const [items, setItems]   = useState(() => getList(TYPES[0]))
  const [modal, setModal]   = useState(null) // null | { mode:'add'|'edit', item }
  const [search, setSearch] = useState('')
  const [delId, setDelId]   = useState(null)

  const switchType = (t) => { setType(t); setItems(getList(t)); setSearch('') }
  const codeField  = getCodeField(type)

  const filtered = items.filter(i => {
    const code = (i[codeField] || '').toUpperCase()
    const name = descriptionFor(type, i).text.toUpperCase()
    const q = search.toUpperCase()
    return code.includes(q) || name.includes(q)
  })

  const handleSave = (form) => {
    let updated
    if (modal.mode === 'add') {
      updated = [...items, { ...form, id: Date.now().toString() }]
    } else {
      updated = items.map(i => i.id === modal.item.id ? { ...i, ...form } : i)
    }
    saveList(type, updated)
    setItems(updated)
    setModal(null)
  }

  const handleDelete = (id) => {
    const updated = items.filter(i => i.id !== id)
    saveList(type, updated)
    setItems(updated)
    setDelId(null)
  }

  return (
    <div>
      {/* Type selector */}
      <div className="section-toggle-group mb-12">
        {TYPES.map(t => (
          <button key={t} className={`section-toggle ${type === t ? 'active' : ''}`} onClick={() => switchType(t)}>{t}</button>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <input className="form-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'add', item: buildEmpty(type) })}>+ Add</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">No items found. Click "+ Add" to add your first entry.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name / Description</th>
                  {type === 'ABX' && <th>Prefix</th>}
                  {type === 'Drug (PHQ)' && <th>Unit</th>}
                  {type === 'Exp After Open' && <th>Days</th>}
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id || item[codeField]}>
                    <td><code style={{ fontFamily: 'monospace', fontSize: 13 }}>{item[codeField]}</code></td>
                    <td style={{ fontSize: 13 }}><DescriptionCell type={type} item={item} /></td>
                    {type === 'ABX' && <td style={{ fontSize: 12 }}>{item.prefix}</td>}
                    {type === 'Drug (PHQ)' && <td style={{ fontSize: 12 }}>{item.unit}</td>}
                    {type === 'Exp After Open' && <td style={{ fontSize: 12 }}>{item.days} days</td>}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: 'edit', item })}>✏</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(item.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="modal-title">{modal.mode === 'add' ? 'Add' : 'Edit'} {type}</div>
              <ItemForm type={type} initial={modal.item} onSave={handleSave} onCancel={() => setModal(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {delId && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ maxWidth: 320, textAlign: 'center' }}>
              <div className="modal-title">Confirm Delete</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Are you sure you want to delete this entry?</p>
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
