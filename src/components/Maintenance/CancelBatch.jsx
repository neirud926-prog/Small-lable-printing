import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTodayInUseBatches, updateBatchStatus, resetCounter, getTodayItemCounters, getSettings } from '../../utils/storage'

export default function CancelBatch() {
  const [batches, setBatches]     = useState(getTodayInUseBatches)
  const [selected, setSelected]   = useState('')
  const [success, setSuccess]     = useState('')
  const [resetLoc, setResetLoc]   = useState(() => getSettings().location === 'EC' ? 'EC' : 'IPOP')
  const [resetCode, setResetCode] = useState('')
  const [resetVal, setResetVal]   = useState('')
  const itemCounters = getTodayItemCounters()

  const successTimer = useRef(null)
  const showSuccess = (msg) => {
    setSuccess(msg)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setSuccess(''), 3000)
  }
  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current)
  }, [])

  const handleCancel = () => {
    if (!selected) return
    const batch = batches.find(b => b.batchNo === selected)
    if (!batch) return
    updateBatchStatus(batch.id, 'Cancel Order')
    showSuccess(`Batch ${selected} has been cancelled.`)
    setBatches(getTodayInUseBatches())
    setSelected('')
  }

  const handleReset = () => {
    const code = resetCode.trim().toUpperCase()
    const parsed = parseInt(resetVal, 10)
    if (!code || !Number.isFinite(parsed) || parsed < 1) return
    const saved = resetCounter(resetLoc, code, parsed)
    showSuccess(`Counter for ${code} (${resetLoc}) reset to ${saved}.`)
    setResetCode('')
    setResetVal('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cancel Batch */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--danger)' }}>Cancel Batch Number</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Select a batch generated today to mark it as "Cancel Order":
        </div>

        {batches.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>No "In Use" batches for today.</div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Today's In-Use Batches</label>
              <select className="form-select" value={selected} onChange={e => setSelected(e.target.value)}>
                <option value="">— Select a batch —</option>
                {batches.map(b => (
                  <option key={b.id} value={b.batchNo}>
                    {b.batchNo} | {b.itemCode} | {b.location}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-danger" onClick={handleCancel} disabled={!selected}>
              Cancel This Batch
            </button>
          </>
        )}

        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ color: 'var(--success)', fontSize: 13, marginTop: 12, fontWeight: 600 }}>
              ✓ {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset Counters */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Reset Batch Counters</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Each item has its own counter per location, restarting at 01 every day.
          Next number today:{' '}
          {itemCounters.length === 0
            ? <strong>none issued yet</strong>
            : itemCounters.map((c, i) => (
                <span key={`${c.location}:${c.itemCode}`}>
                  {i > 0 && ' · '}{c.itemCode} ({c.location === 'IPOP' ? 'IP/OP' : c.location}) = <strong>{c.n}</strong>
                </span>
              ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div className="form-label mb-8">Location</div>
            <select className="form-select" value={resetLoc} onChange={e => setResetLoc(e.target.value)}>
              <option value="IPOP">IP/OP</option>
              <option value="EC">EC</option>
            </select>
          </div>
          <div>
            <div className="form-label mb-8">Item Code</div>
            <input className="form-input" value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="e.g. AUGM06" />
          </div>
          <div>
            <div className="form-label mb-8">Reset counter to</div>
            <input className="form-input" type="number" min={1} value={resetVal} onChange={e => setResetVal(e.target.value)} placeholder="e.g. 1" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleReset} disabled={!resetCode.trim() || !resetVal}>Reset</button>
        </div>
      </div>
    </div>
  )
}
