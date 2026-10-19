import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getExtempList, getExpiryRules, getSettings, addBatchRecord, getItemDescription } from '../../utils/storage'
import { generateBatchNo, calcExpiryDate, formatDateLabel, commitBatchNo } from '../../utils/batchNumber'
import { printLabel, buildExtempLabelHTML } from '../../utils/labelPrint'
import LabelPreview from '../LabelPreview'
import DataMatrixStatus, { useLabelDataMatrix } from './DataMatrixStatus'

export default function ExtempTab() {
  const [itemCode, setItemCode]       = useState('')
  const [description, setDescription] = useState('')
  const [descFound, setDescFound]     = useState(true)
  const [batchNo, setBatchNo]         = useState('')
  const [expiry, setExpiry]           = useState('')
  const [storage, setStorage]         = useState('')
  const [warning, setWarning]         = useState('')
  const [factor, setFactor]           = useState(1)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const extempList = getExtempList()
  const settings = getSettings()
  const location = settings.location || 'EC'

  // Internal GTIN 2D code: item code, Pack Volume from the Extemp record's
  // Volume, and the Use Before / batch number exactly as printed.
  const dm = useLabelDataMatrix({
    itemCode,
    record: extempList.find(e => e.itemCode === itemCode) || null,
    expiryText: expiry,
    lot: batchNo,
    settings,
  })

  useEffect(() => {
    if (!itemCode) { clearAll(); return }
    const item = extempList.find(e => e.itemCode === itemCode)
    const desc = getItemDescription(itemCode)
    setDescription(desc.description)
    setDescFound(desc.found)
    const rules = getExpiryRules()
    const rule = rules.find(r => r.itemCode === itemCode && r.status === 'Active')
    // Never carry the previous item's date / storage / warning over to this one.
    setExpiry(rule ? formatDateLabel(calcExpiryDate(rule.shelfLifeValue, rule.shelfLifeUnit)) : '')
    setStorage(rule ? rule.storage || '' : '')
    setWarning(rule ? rule.warning || '' : '')
    const prefix = item ? item.prefix : ''
    const bn = generateBatchNo('EC', prefix, !!prefix, itemCode) + (getCounterSuffix())
    setBatchNo(bn)
  }, [itemCode])

  const getCounterSuffix = () => '' // counter already embedded in generateBatchNo

  const handleConfirm = () => {
    if (!itemCode) { setError('Please select an item code.'); return }
    if (!expiry)   { setError('No expiry rule found — add one in Maintenance.'); return }
    if (!descFound && !window.confirm(`${itemCode} is not in the item list, so the label will show the item code instead of a description.\nPrint anyway?`)) return
    const dmPrint = dm.prepare()
    if (!dmPrint.ok) { if (dmPrint.error) setError(dmPrint.error); return }

    const copies = Math.ceil((parseInt(factor) + 2) / 2)
    const html = buildExtempLabelHTML(description, batchNo, expiry, storage, warning, '', settings, dmPrint.symbol)
    printLabel(html, copies, settings)

    addBatchRecord({
      date: new Date().toLocaleDateString('en-CA'),
      location: 'EC',
      itemCode,
      batchNo,
      expiry,
      labelCount: copies * 2,
      status: 'In Use',
      notes: `${factor} x Extemp`,
    })

    commitBatchNo('EC', itemCode, batchNo)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    clearAll()
  }

  const clearAll = () => {
    setItemCode(''); setDescription(''); setDescFound(true); setBatchNo(''); setExpiry('')
    setStorage(''); setWarning(''); setFactor(1); setError('')
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#34a853' }}>Extemporaneous Preparation Label</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Item Code</label>
          <select className="form-select" value={itemCode} onChange={e => setItemCode(e.target.value)}>
            <option value="">— Select Item Code —</option>
            {extempList.map(e => (
              <option key={e.id || e.itemCode} value={e.itemCode}>{e.itemCode}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={description} readOnly style={{ background: 'var(--bg)' }} />
          {!descFound && <div style={{ color: 'var(--warning)', fontSize: 12, marginTop: 4 }}>⚠ Not in item list — showing item code</div>}
        </div>
        <div className="form-group">
          <label className="form-label">No. of Bottles / Units</label>
          <input className="form-input" type="number" min={1} value={factor} onChange={e => setFactor(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 13 }}>
        <div>Batch No: <strong style={{ fontFamily: 'monospace' }}>{batchNo || '—'}</strong></div>
        <div>Use Before: <strong style={{ color: expiry ? 'var(--success)' : 'var(--danger)' }}>{expiry || '—'}</strong></div>
        {storage && <div style={{ color: 'var(--text-muted)' }}>Storage: {storage}</div>}
        {warning && <div style={{ color: 'var(--warning)' }}>⚠ {warning}</div>}
      </div>

      {itemCode && expiry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <LabelPreview
            settings={settings}
            type="extemp"
            description={description}
            batchNo={batchNo}
            expiry={expiry}
            storage={storage}
            warning={warning}
            symbol={dm.previewSymbol}
            scale={3}
            label="Label preview"
            onFit={dm.onFit}
          />
          <DataMatrixStatus symbol={dm.symbol} fits={dm.fits} />
        </div>
      )}

      <AnimatePresence>
        {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>⚠ {error}</motion.div>}
        {success && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12, fontWeight: 700 }}>✓ Labels printed & record saved!</motion.div>}
      </AnimatePresence>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={!itemCode}>🖨 Confirm & Print</button>
        <button className="btn btn-ghost" onClick={clearAll}>Clear</button>
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        Copies: <strong>{Math.ceil((parseInt(factor) + 2) / 2)}</strong> · Location: EC
      </div>
    </div>
  )
}
