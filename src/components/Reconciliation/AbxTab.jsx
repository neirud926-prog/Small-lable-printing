import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAbxList, getActiveManufacturers, getExpiryRule, getSettings } from '../../utils/storage'
import { addBatchRecord } from '../../utils/storage'
import { generateBatchNo, calcExpiryDate, formatDateLabel, commitBatchNo } from '../../utils/batchNumber'
import { printLabel, buildAbxLabelHTML, buildSmallLabelHTML } from '../../utils/labelPrint'

export default function AbxTab() {
  const [itemCode, setItemCode]       = useState('')
  const [description, setDescription] = useState('')
  const [manufacturers, setManufacturers] = useState([])
  const [manufacturer, setManufacturer]   = useState('')
  const [usePrefix, setUsePrefix]     = useState(true)
  const [factor, setFactor]           = useState(1)
  const [batchNo, setBatchNo]         = useState('')
  const [expiry, setExpiry]           = useState('')
  const [ipopToggle, setIpopToggle]   = useState('OP')
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const abxList = getAbxList()
  const settings = getSettings()
  const location = settings.location || 'IP/OP'
  const storageKey = location === 'EC' ? 'EC' : 'IPOP'

  useEffect(() => {
    if (!itemCode) { setDescription(''); setManufacturers([]); setManufacturer(''); setBatchNo(''); setExpiry(''); return }
    const abx = abxList.find(a => a.itemCode === itemCode)
    if (abx) setDescription(abx.description || '')
    const mfrs = getActiveManufacturers(itemCode)
    setManufacturers(mfrs)
    setManufacturer(mfrs[0] || '')
    recalcBatch(itemCode, usePrefix, abx)
  }, [itemCode])

  useEffect(() => {
    if (!itemCode) return
    const abx = abxList.find(a => a.itemCode === itemCode)
    recalcBatch(itemCode, usePrefix, abx)
  }, [usePrefix])

  useEffect(() => {
    if (!itemCode || !manufacturer) { setExpiry(''); return }
    const rule = getExpiryRule(itemCode, manufacturer)
    if (rule) {
      const d = calcExpiryDate(rule.shelfLifeValue, rule.shelfLifeUnit)
      setExpiry(formatDateLabel(d))
    } else {
      setExpiry('')
    }
  }, [manufacturer])

  const recalcBatch = (code, prefix, abx) => {
    const pfx = abx ? abx.prefix : ''
    const bn = generateBatchNo(storageKey, pfx, prefix)
    setBatchNo(bn)
  }

  const handleConfirm = () => {
    if (!itemCode) { setError('Please select an item code.'); return }
    if (!manufacturer) { setError('Please select a manufacturer.'); return }
    if (!expiry) { setError('Could not calculate expiry — check expiry rules in Maintenance.'); return }

    const copies = Math.ceil((parseInt(factor) + 1) / 3)

    // ABX label
    const abxHtml = buildAbxLabelHTML(description, batchNo, expiry, itemCode)
    printLabel(abxHtml, copies)

    // If IP toggle selected, also print small IP label
    if (ipopToggle === 'IP') {
      const smallHtml = buildSmallLabelHTML(description, 'IP', batchNo, expiry, itemCode)
      printLabel(smallHtml, 1)
    }

    // Save batch record
    addBatchRecord({
      date: new Date().toLocaleDateString('en-CA'),
      location: storageKey,
      itemCode,
      batchNo,
      expiry,
      labelCount: copies * 3,
      status: 'In Use',
      notes: `${factor} x ABX | ${manufacturer}`,
    })

    commitBatchNo(storageKey)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    handleClear()
  }

  const handleClear = () => {
    setItemCode(''); setDescription(''); setManufacturers([]); setManufacturer('')
    setBatchNo(''); setExpiry(''); setFactor(1); setError('')
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--primary)' }}>ABX Preparation Label</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Item Code</label>
          <select className="form-select" value={itemCode} onChange={e => setItemCode(e.target.value)}>
            <option value="">— Select Item Code —</option>
            {abxList.map(a => (
              <option key={a.id || a.itemCode} value={a.itemCode}>{a.itemCode}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Drug Description</label>
          <input className="form-input" value={description} readOnly style={{ background: 'var(--bg)' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Manufacturer</label>
          <select className="form-select" value={manufacturer} onChange={e => setManufacturer(e.target.value)} disabled={!itemCode}>
            <option value="">— Select —</option>
            {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">No. of Vials / Packs</label>
          <input className="form-input" type="number" min={1} value={factor} onChange={e => setFactor(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={usePrefix} onChange={e => setUsePrefix(e.target.checked)} />
          Include prefix in batch no.
        </label>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Batch No: <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{batchNo || '—'}</strong>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Use Before: <strong style={{ color: expiry ? 'var(--success)' : 'var(--danger)' }}>{expiry || '—'}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Also print small label:</span>
        <div className="section-toggle-group">
          {['OP', 'IP', 'None'].map(t => (
            <button key={t} className={`section-toggle ${ipopToggle === t ? 'active' : ''}`} onClick={() => setIpopToggle(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>⚠ {error}</motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12, fontWeight: 700 }}>✓ Labels printed & record saved!</motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={!itemCode || !manufacturer}>
          🖨 Confirm & Print
        </button>
        <button className="btn btn-ghost" onClick={handleClear}>Clear</button>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        Labels to print: <strong>{Math.ceil((parseInt(factor) + 1) / 3)}</strong> copies (3 labels per sheet) · Location: <strong>{storageKey}</strong>
      </div>
    </div>
  )
}
