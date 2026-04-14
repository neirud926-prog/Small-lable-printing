import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getPrepackList, getExpiryRules, getSettings, addBatchRecord } from '../../utils/storage'
import { generateBatchNo, calcExpiryDate, formatDateLabel, commitBatchNo } from '../../utils/batchNumber'
import { printLabel, buildPrepackLabelHTML } from '../../utils/labelPrint'

const UNITS = ['MG', 'MCG', 'G', 'ML', 'IU', '%', 'MMOL']

export default function PrepackTab() {
  const [drugCode, setDrugCode]       = useState('')
  const [description, setDescription] = useState('')
  const [strength, setStrength]       = useState('')
  const [unit, setUnit]               = useState('MG')
  const [usePrefix, setUsePrefix]     = useState(true)
  const [batchNo, setBatchNo]         = useState('')
  const [expiry, setExpiry]           = useState('')
  const [customExpiry, setCustomExpiry] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [labelCount, setLabelCount]   = useState(1)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const prepackList = getPrepackList()
  const settings = getSettings()
  const storageKey = settings.location === 'EC' ? 'EC' : 'IPOP'

  useEffect(() => {
    if (!drugCode) { clearAll(); return }
    const item = prepackList.find(p => p.drugCode === drugCode)
    if (item) setDescription(item.description || '')
    const rules = getExpiryRules()
    const rule = rules.find(r => r.itemCode === drugCode && r.status === 'Active')
    if (rule) {
      const d = calcExpiryDate(rule.shelfLifeValue, rule.shelfLifeUnit)
      setExpiry(formatDateLabel(d))
    }
    const prefix = item ? item.prefix : ''
    setBatchNo(generateBatchNo(storageKey, prefix, usePrefix && !!prefix))
  }, [drugCode, usePrefix])

  const finalDescription = description + (strength ? ` ${strength}${unit}` : '')

  const handleConfirm = () => {
    if (!drugCode) { setError('Please select a drug code.'); return }
    const useExpiry = customExpiry || expiry
    if (!useExpiry) { setError('No expiry date — check expiry rules or enter one manually.'); return }

    // Confirm use-before date
    const confirmMsg = `Use Before: ${useExpiry}\nIs this correct?`
    if (!window.confirm(confirmMsg)) {
      setShowOverride(true)
      return
    }

    doPrint(useExpiry)
  }

  const doPrint = (useExpiry) => {
    const html = buildPrepackLabelHTML(finalDescription, batchNo, useExpiry, settings)
    printLabel(html, parseInt(labelCount), settings)

    addBatchRecord({
      date: new Date().toLocaleDateString('en-CA'),
      location: storageKey,
      itemCode: drugCode,
      batchNo,
      expiry: useExpiry,
      labelCount: parseInt(labelCount),
      status: 'In Use',
      notes: `Prepack ${strength}${unit}`,
    })

    commitBatchNo(storageKey)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    clearAll()
  }

  const clearAll = () => {
    setDrugCode(''); setDescription(''); setStrength(''); setBatchNo(''); setExpiry('')
    setCustomExpiry(''); setShowOverride(false); setLabelCount(1); setError('')
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#fbbc05' }}>Pre-packed Drug Label</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Drug Code</label>
          <select className="form-select" value={drugCode} onChange={e => setDrugCode(e.target.value)}>
            <option value="">— Select Drug Code —</option>
            {prepackList.map(p => (
              <option key={p.id || p.drugCode} value={p.drugCode}>{p.drugCode}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={description} readOnly style={{ background: 'var(--bg)' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Strength</label>
          <input className="form-input" placeholder="e.g. 500" value={strength} onChange={e => setStrength(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Unit</label>
          <select className="form-select" value={unit} onChange={e => setUnit(e.target.value)}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Number of Labels</label>
          <input className="form-input" type="number" min={1} value={labelCount} onChange={e => setLabelCount(e.target.value)} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
        <input type="checkbox" checked={usePrefix} onChange={e => setUsePrefix(e.target.checked)} />
        Include prefix in batch no.
      </label>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 13 }}>
        <div>Batch No: <strong style={{ fontFamily: 'monospace' }}>{batchNo || '—'}</strong></div>
        <div>Use Before: <strong style={{ color: (customExpiry || expiry) ? 'var(--success)' : 'var(--danger)' }}>{customExpiry || expiry || '—'}</strong></div>
      </div>

      {showOverride && (
        <div className="form-group">
          <label className="form-label">Override Use Before Date</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" placeholder="DD/MM/YYYY" value={customExpiry} onChange={e => setCustomExpiry(e.target.value)} />
            <button className="btn btn-primary" onClick={() => { setShowOverride(false); doPrint(customExpiry || expiry) }}>Confirm</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>⚠ {error}</motion.div>}
        {success && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12, fontWeight: 700 }}>✓ Labels printed!</motion.div>}
      </AnimatePresence>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={!drugCode}>🖨 Confirm & Print</button>
        <button className="btn btn-ghost" onClick={clearAll}>Clear</button>
      </div>
    </div>
  )
}
