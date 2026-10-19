import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { findDrugByCode, getItemLocation, getMobileShelfBin, findEV54Drug, getSettings } from '../../utils/storage'
import { formatDateLabel } from '../../utils/batchNumber'
import { printPickList } from '../../utils/pickListPrint'
import { classifyScannedInput } from '../../utils/barcodeDecoder'
import { resolveGtinScan } from '../../utils/scanLookup'

export default function PrintPickList() {
  const [rows, setRows]             = useState([])
  const [code, setCode]             = useState('')
  const [qty, setQty]               = useState('')
  const [error, setError]           = useState('')
  const [preparedBy, setPreparedBy] = useState('')
  const [mergedFlash, setMergedFlash] = useState(null)

  const codeRef = useRef(null)
  const qtyRef  = useRef(null)

  useEffect(() => { codeRef.current?.focus() }, [])

  const totals = useMemo(() => {
    const bottles = rows.reduce((sum, r) => sum + (parseInt(r.quantity, 10) || 0), 0)
    return { items: rows.length, bottles, containers: rows.length }
  }, [rows])

  const flashMerge = (itemCode) => {
    setMergedFlash(itemCode)
    setTimeout(() => setMergedFlash(prev => prev === itemCode ? null : prev), 900)
  }

  const addRow = () => {
    const raw = code.trim()
    // Accept 6-char item code, 13-char IP barcode, or GTIN scan — all resolve to an item code.
    const c = classifyScannedInput(raw, getSettings().barcodeMethod || 'gs1')
    let up = ''
    switch (c.kind) {
      case 'op-code':
      case 'ip-code': up = c.itemCode; break
      case 'gtin':    up = resolveGtinScan(c).itemCode; break
      default:
        setError('Enter a 6-char item code or scan a barcode')
        codeRef.current?.focus()
        return
    }
    if (!up) {
      setError('Could not resolve item code from input')
      codeRef.current?.focus()
      return
    }
    const drug = findDrugByCode(up)
    if (!drug) {
      setError(`Item code "${up}" not found in PHQ data`)
      codeRef.current?.focus()
      codeRef.current?.select()
      return
    }
    if (getSettings().restrictToEV54List && !findEV54Drug(up)) {
      setError(`${up} is not on the EV54 drug list`)
      codeRef.current?.focus()
      codeRef.current?.select()
      return
    }
    const n = parseInt(qty, 10)
    if (!Number.isFinite(n) || n < 1) {
      setError('Quantity must be at least 1')
      qtyRef.current?.focus()
      return
    }

    setRows(prev => {
      const idx = prev.findIndex(r => r.itemCode === up)
      if (idx >= 0) {
        const next = prev.slice()
        next[idx] = { ...next[idx], quantity: (parseInt(next[idx].quantity, 10) || 0) + n }
        flashMerge(up)
        return next
      }
      return [...prev, {
        itemCode: up,
        name: drug.name,
        mobileBin: getMobileShelfBin(up),
        location: getItemLocation(up),
        quantity: n,
      }]
    })

    setCode('')
    setQty('')
    setError('')
    setTimeout(() => codeRef.current?.focus(), 0)
  }

  const updateQty = (itemCode, value) => {
    const n = parseInt(value, 10)
    setRows(prev => prev.map(r =>
      r.itemCode === itemCode
        ? { ...r, quantity: Number.isFinite(n) && n >= 1 ? n : value }
        : r
    ))
  }

  const removeRow = (itemCode) => {
    setRows(prev => prev.filter(r => r.itemCode !== itemCode))
  }

  const clearAll = () => {
    if (rows.length === 0) return
    if (window.confirm(`Clear all ${rows.length} row(s)?`)) {
      setRows([])
      setError('')
      setCode('')
      setQty('')
      codeRef.current?.focus()
    }
  }

  const handlePrint = () => {
    if (rows.length === 0) return
    const sorted = rows.slice().sort((a, b) => {
      const la = (a.mobileBin || a.location || '')
      const lb = (b.mobileBin || b.location || '')
      if (la === '' && lb !== '') return 1
      if (lb === '' && la !== '') return -1
      return la.localeCompare(lb, undefined, { numeric: true, sensitivity: 'base' })
    })
    const normalised = sorted.map(r => ({
      ...r,
      quantity: Math.max(1, parseInt(r.quantity, 10) || 1),
    }))
    printPickList(normalised, {
      preparedBy: preparedBy.trim(),
      date: formatDateLabel(new Date()),
      totals,
    })
  }

  const onCodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      qtyRef.current?.focus()
    }
  }

  const onQtyKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addRow()
    }
  }

  return (
    <div>
      {/* Entry form */}
      <div className="card mb-12">
        <div className="form-label mb-8">📝 Add Item</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Item Code or Scan</div>
            <input
              ref={codeRef}
              className="form-input"
              placeholder="ABCD01 · 13-char IP · GTIN"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); if (error) setError('') }}
              onKeyDown={onCodeKeyDown}
              autoComplete="off"
              style={{ fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ flex: '0 0 120px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Quantity (bottles)</div>
            <input
              ref={qtyRef}
              className="form-input"
              type="number"
              min={1}
              placeholder="1"
              value={qty}
              onChange={e => { setQty(e.target.value); if (error) setError('') }}
              onKeyDown={onQtyKeyDown}
              autoComplete="off"
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={addRow}>Add</button>
          </div>
        </div>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginTop: 10, color: 'var(--danger)', fontSize: 13 }}
            >
              ⚠ {error}
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          Tip: press <strong>Enter</strong> in Item Code to jump to Quantity, then <strong>Enter</strong> again to add and continue.
        </div>
      </div>

      {/* List */}
      <div className="card mb-12">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="form-label" style={{ margin: 0 }}>📋 Pick List ({rows.length})</div>
          <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={rows.length === 0}>
            Clear All
          </button>
        </div>

        {rows.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
            No items added yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px', width: 32 }}>#</th>
                  <th style={{ padding: '8px 6px' }}>Code</th>
                  <th style={{ padding: '8px 6px' }}>Description</th>
                  <th style={{ padding: '8px 6px' }}>Location</th>
                  <th style={{ padding: '8px 6px', width: 90 }}>Qty</th>
                  <th style={{ padding: '8px 6px', width: 36 }} />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((r, i) => (
                    <motion.tr
                      key={r.itemCode}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: mergedFlash === r.itemCode ? 'rgba(26,115,232,0.12)' : 'rgba(26,115,232,0)',
                      }}
                      exit={{ opacity: 0 }}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontWeight: 600 }}>{r.itemCode}</td>
                      <td style={{ padding: '8px 6px' }}>{r.name}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {r.mobileBin && (
                            <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>🟢 Mobile {r.mobileBin}</span>
                          )}
                          {r.location && (
                            <span style={{ fontSize: 12, background: '#e8f0fe', color: 'var(--primary)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>📍 Shelf {r.location}</span>
                          )}
                          {!r.mobileBin && !r.location && (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          className="form-input"
                          type="number"
                          min={1}
                          value={r.quantity}
                          onChange={e => updateQty(r.itemCode, e.target.value)}
                          style={{ width: 72, padding: '4px 8px', fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                        <button
                          onClick={() => removeRow(r.itemCode)}
                          title="Remove row"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--danger)', fontSize: 18, lineHeight: 1, padding: 4,
                          }}
                        >×</button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer: prepared-by + totals + print */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 180 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Prepared by</div>
            <input
              className="form-input"
              placeholder="Your name"
              value={preparedBy}
              onChange={e => setPreparedBy(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div style={{ flex: '1 1 260px', fontSize: 13, color: 'var(--text-muted)' }}>
            <div><strong style={{ color: 'var(--text)' }}>{totals.items}</strong> items · <strong style={{ color: 'var(--text)' }}>{totals.bottles}</strong> bottles</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>Plastic containers required: <strong style={{ color: 'var(--text)' }}>{totals.containers}</strong> (one per drug line)</div>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handlePrint}
              disabled={rows.length === 0}
            >
              🖨 Print
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
