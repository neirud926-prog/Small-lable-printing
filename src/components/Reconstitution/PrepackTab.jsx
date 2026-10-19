import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getPrepackList, getExpiryRules, getSettings, addBatchRecord, getItemDescription, findByGtin, findDrugByCode } from '../../utils/storage'
import { generateBatchNo, calcExpiryDate, formatDateLabel, commitBatchNo } from '../../utils/batchNumber'
import { printLabel, buildPrepackLabelHTML } from '../../utils/labelPrint'
import { classifyScannedInput, resolveScannedGtin } from '../../utils/barcodeDecoder'
import { buildLabelDataMatrix } from '../../utils/labelDataMatrix'
import LabelPreview from '../LabelPreview'
import DataMatrixStatus, { confirmWithoutDataMatrix, symbolToPrint } from './DataMatrixStatus'

const UNITS = ['MG', 'MCG', 'G', 'ML', 'IU', '%', 'MMOL']

export default function PrepackTab() {
  const [drugCode, setDrugCode]       = useState('')
  const [description, setDescription] = useState('')
  const [descFound, setDescFound]     = useState(true)
  const [strength, setStrength]       = useState('')
  const [unit, setUnit]               = useState('MG')
  const [batchNo, setBatchNo]         = useState('')
  const [expiry, setExpiry]           = useState('')
  const [customExpiry, setCustomExpiry] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [labelCount, setLabelCount]   = useState(1)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const [scan, setScan]               = useState('')
  const [textFits, setTextFits]       = useState(true)   // label text fits beside the 2D code (preview check)
  const prepackList = getPrepackList()
  const settings = getSettings()
  const storageKey = settings.location === 'EC' ? 'EC' : 'IPOP'
  const record = prepackList.find(p => p.drugCode === drugCode) || null

  // Internal GTIN 2D code for this label: drug code, Pack Volume from the
  // Prepack record, and the Use Before / batch number exactly as printed.
  const symbolFor = (useExpiry) => buildLabelDataMatrix({
    itemCode: drugCode, record, expiryText: useExpiry, lot: batchNo, settings,
  })

  // Scan (or type) a code to pick the drug: 6-char code, 13-char IP barcode,
  // manufacturer GTIN or Internal GTIN 2D code. It must be on the Prepack list.
  const handleScan = (raw) => {
    if (!raw.trim()) return
    const c = classifyScannedInput(raw, settings.barcodeMethod || 'gs1')
    let code = ''
    if (c.kind === 'op-code' || c.kind === 'ip-code') code = c.itemCode
    else if (c.kind === 'gtin') {
      code = resolveScannedGtin(c, {
        findByGtin,
        isItemCode: x => !!findDrugByCode(x) || prepackList.some(p => p.drugCode.toUpperCase() === x),
      }).itemCode
    }
    if (!code) { setError('Could not read an item code from that scan.'); return }
    const match = prepackList.find(p => p.drugCode.toUpperCase() === code.toUpperCase())
    if (!match) { setError(`${code} is not on the Prepack list.`); return }
    setError('')
    setScan('')
    setDrugCode(match.drugCode)
  }

  useEffect(() => {
    if (!drugCode) { clearAll(); return }
    const item = prepackList.find(p => p.drugCode === drugCode)
    const desc = getItemDescription(drugCode)
    setDescription(desc.description)
    setDescFound(desc.found)
    const rules = getExpiryRules()
    const rule = rules.find(r => r.itemCode === drugCode && r.status === 'Active')
    if (rule) {
      const d = calcExpiryDate(rule.shelfLifeValue, rule.shelfLifeUnit)
      setExpiry(formatDateLabel(d))
    }
    const prefix = item ? item.prefix : ''
    setBatchNo(generateBatchNo(storageKey, prefix, !!prefix, drugCode))
  }, [drugCode])

  const finalDescription = description + (strength ? ` ${strength}${unit}` : '')

  const handleConfirm = () => {
    if (!drugCode) { setError('Please select a drug code.'); return }
    const useExpiry = customExpiry || expiry
    if (!useExpiry) { setError('No expiry date — check expiry rules or enter one manually.'); return }
    if (!descFound && !window.confirm(`${drugCode} is not in the item list, so the label will show the item code instead of a description.\nPrint anyway?`)) return

    // Confirm use-before date
    const confirmMsg = `Use Before: ${useExpiry}\nIs this correct?`
    if (!window.confirm(confirmMsg)) {
      setShowOverride(true)
      return
    }

    doPrint(useExpiry)
  }

  const doPrint = (useExpiry) => {
    const symbol = symbolFor(useExpiry)
    if (!confirmWithoutDataMatrix(symbol, textFits)) return
    const html = buildPrepackLabelHTML(finalDescription, batchNo, useExpiry, settings, symbolToPrint(symbol, textFits))
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

    commitBatchNo(storageKey, drugCode, batchNo)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    clearAll()
  }

  const clearAll = () => {
    setDrugCode(''); setDescription(''); setDescFound(true); setStrength(''); setBatchNo(''); setExpiry('')
    setCustomExpiry(''); setShowOverride(false); setLabelCount(1); setError('')
  }

  const previewExpiry = customExpiry || expiry
  const previewSymbol = drugCode && batchNo && previewExpiry ? symbolFor(previewExpiry) : null

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#fbbc05' }}>Pre-packed Drug Label</div>

      <div className="form-group">
        <label className="form-label">Scan or Type Code</label>
        <input
          className="form-input"
          style={{ fontFamily: 'monospace' }}
          placeholder="Scan a barcode or 2D code, or type the drug code — then press Enter"
          value={scan}
          onChange={e => setScan(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); return }
            if (e.key === 'Enter') handleScan(scan)
          }}
          autoComplete="off"
        />
      </div>

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
          {!descFound && <div style={{ color: 'var(--warning)', fontSize: 12, marginTop: 4 }}>⚠ Not in item list — showing item code</div>}
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

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 13 }}>
        <div>Batch No: <strong style={{ fontFamily: 'monospace' }}>{batchNo || '—'}</strong></div>
        <div>Use Before: <strong style={{ color: (customExpiry || expiry) ? 'var(--success)' : 'var(--danger)' }}>{customExpiry || expiry || '—'}</strong></div>
      </div>

      {drugCode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <LabelPreview
            settings={settings}
            type="prepack"
            description={finalDescription}
            batchNo={batchNo}
            expiry={previewExpiry}
            symbol={symbolToPrint(previewSymbol)}
            scale={3}
            label="Label preview"
            onFit={setTextFits}
          />
          <DataMatrixStatus symbol={previewSymbol} fits={textFits} />
        </div>
      )}

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
