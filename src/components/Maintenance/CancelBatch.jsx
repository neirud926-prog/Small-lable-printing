import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTodayInUseBatches, updateBatchStatus, resetCounter, getCounter } from '../../utils/storage'

export default function CancelBatch() {
  const [batches, setBatches]     = useState(getTodayInUseBatches)
  const [selected, setSelected]   = useState('')
  const [success, setSuccess]     = useState('')
  const [ecReset, setEcReset]     = useState('')
  const [ipopReset, setIpopReset] = useState('')
  const ecCount   = getCounter('EC')
  const ipopCount = getCounter('IPOP')

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

  const handleReset = (loc, val) => {
    const parsed = parseInt(val, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return
    const saved = resetCounter(loc, parsed)
    showSuccess(`Counter for ${loc} reset to ${saved}.`)
    if (loc === 'EC') setEcReset('')
    else setIpopReset('')
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
          Current counters: EC = <strong>{ecCount}</strong> · IP/OP = <strong>{ipopCount}</strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="form-label mb-8">Reset EC Counter to:</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" type="number" min={1} value={ecReset} onChange={e => setEcReset(e.target.value)} placeholder="e.g. 1" />
              <button className="btn btn-primary btn-sm" onClick={() => handleReset('EC', ecReset)}>Reset</button>
            </div>
          </div>
          <div>
            <div className="form-label mb-8">Reset IP/OP Counter to:</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" type="number" min={1} value={ipopReset} onChange={e => setIpopReset(e.target.value)} placeholder="e.g. 1" />
              <button className="btn btn-primary btn-sm" onClick={() => handleReset('IPOP', ipopReset)}>Reset</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
