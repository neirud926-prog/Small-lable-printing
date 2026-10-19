import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAbxList, getActiveManufacturers, getExpiryRule, getSettings, getItemDescription } from '../../utils/storage'
import { addBatchRecord } from '../../utils/storage'
import { generateBatchNo, calcExpiryDate, formatDateLabel, commitBatchNo } from '../../utils/batchNumber'
import { printReconstitutionLabel, printLabel, buildSmallLabelHTML } from '../../utils/labelPrint'
import LabelPreview from '../LabelPreview'
import DataMatrixStatus, { useLabelDataMatrix } from './DataMatrixStatus'

export default function AbxTab() {
  const [itemCode, setItemCode]       = useState('')
  const [description, setDescription] = useState('')
  const [descFound, setDescFound]     = useState(true)
  const [manufacturers, setManufacturers] = useState([])
  const [manufacturer, setManufacturer]   = useState('')
  const [factor, setFactor]           = useState(1)
  const [batchNo, setBatchNo]         = useState('')
  const [expiry, setExpiry]           = useState('')
  const [ipopToggle, setIpopToggle]   = useState('IP')
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const abxList = getAbxList()
  const settings = getSettings()
  const location = settings.location || 'IP/OP'
  const storageKey = location === 'EC' ? 'EC' : 'IPOP'

  // Internal GTIN 2D code for the reconstitution label (lower half): item
  // code, Pack Volume from the ABX record's Pack Size, and the Use Before /
  // batch number exactly as printed.
  const dm = useLabelDataMatrix({
    itemCode,
    record: abxList.find(a => a.itemCode === itemCode) || null,
    expiryText: expiry,
    lot: batchNo,
    settings,
    region: 'lower-half',
  })

  useEffect(() => {
    if (!itemCode) { setDescription(''); setDescFound(true); setManufacturers([]); setManufacturer(''); setBatchNo(''); setExpiry(''); return }
    const abx = abxList.find(a => a.itemCode === itemCode)
    const desc = getItemDescription(itemCode)
    setDescription(desc.description)
    setDescFound(desc.found)
    const mfrs = getActiveManufacturers(itemCode)
    setManufacturers(mfrs)
    setManufacturer(mfrs[0] || '')
    recalcBatch(itemCode, abx)
  }, [itemCode])

  useEffect(() => {
    if (!itemCode || !manufacturer) { setExpiry(''); return }
    const rule = getExpiryRule(itemCode, manufacturer)
    if (rule) {
      const d = calcExpiryDate(rule.shelfLifeValue, rule.shelfLifeUnit)
      setExpiry(formatDateLabel(d))
    } else {
      setExpiry('')
    }
  }, [itemCode, manufacturer])   // both: two items can share a manufacturer name

  const recalcBatch = (code, abx) => {
    const pfx = abx ? abx.prefix : ''
    const bn = generateBatchNo(storageKey, pfx, true, code)
    setBatchNo(bn)
  }

  const handleConfirm = () => {
    if (!itemCode) { setError('Please select an item code.'); return }
    if (!manufacturer) { setError('Please select a manufacturer.'); return }
    if (!expiry) { setError('Could not calculate expiry — check expiry rules in Maintenance.'); return }
    if (!descFound && !window.confirm(`${itemCode} is not in the item list, so the label will show the item code instead of a description.\nPrint anyway?`)) return
    const dmPrint = dm.prepare()
    if (!dmPrint.ok) { if (dmPrint.error) setError(dmPrint.error); return }

    // Print Drug Reconstitution label — 50/50 split (Batch No / Use Before),
    // with the Internal GTIN 2D code in the lower half.
    // One per vial/pack + 1 spare for the batch sheet
    const totalLabels = parseInt(factor) + 1
    printReconstitutionLabel(batchNo, expiry, totalLabels, settings, itemCode, dmPrint.symbol)

    // Plus 1 standard small label (4-row layout with Packed/Checked sign blanks)
    // for the batch record sheet. Honours the IP/OP toggle:
    //   IP → expiry row included; OP → expiry row suppressed (lot only).
    const smallHtml = buildSmallLabelHTML(description, ipopToggle, batchNo, expiry, itemCode, settings)
    printLabel(smallHtml, 1, settings)

    // Save batch record
    addBatchRecord({
      date: new Date().toLocaleDateString('en-CA'),
      location: storageKey,
      itemCode,
      batchNo,
      expiry,
      labelCount: totalLabels,
      status: 'In Use',
      notes: `${factor} x ABX | ${manufacturer}`,
    })

    commitBatchNo(storageKey, itemCode, batchNo)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    handleClear()
  }

  const handleClear = () => {
    setItemCode(''); setDescription(''); setDescFound(true); setManufacturers([]); setManufacturer('')
    setBatchNo(''); setExpiry(''); setFactor(1); setError('')
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--primary)' }}>Drug Reconstitution Label</div>

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
          {!descFound && <div style={{ color: 'var(--warning)', fontSize: 12, marginTop: 4 }}>⚠ Not in item list — showing item code</div>}
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
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Batch No: <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{batchNo || '—'}</strong>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Use Before: <strong style={{ color: expiry ? 'var(--success)' : 'var(--danger)' }}>{expiry || '—'}</strong>
        </div>
      </div>

      {itemCode && expiry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <LabelPreview
            settings={settings}
            type="recon"
            itemCode={itemCode}
            batchNo={batchNo}
            expiry={expiry}
            symbol={dm.previewSymbol}
            scale={3}
            label="Reconstitution label preview"
            onFit={dm.onFit}
          />
          <DataMatrixStatus symbol={dm.symbol} fits={dm.fits} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Label type:</span>
        <div className="section-toggle-group">
          {['IP', 'OP'].map(t => (
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
        Small labels: <strong>{(parseInt(factor) || 0) + 1}</strong> ({parseInt(factor) || 0} + 1 spare) · Location: <strong>{storageKey}</strong>
      </div>
    </div>
  )
}
