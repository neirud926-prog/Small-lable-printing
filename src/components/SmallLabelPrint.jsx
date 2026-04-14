import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { decodeBarcode, formatExpiry, isResultValid } from '../utils/barcodeDecoder'
import { findDrugByCode, getExpAfterOpenDays } from '../utils/storage'
import { printLabel, buildSmallLabelHTML } from '../utils/labelPrint'
import { todayYYMMDD, formatDateLabel } from '../utils/batchNumber'

function LabelPreview({ drugName, ipop, lot, exp, itemCode }) {
  if (!drugName) return null
  const isBlack = itemCode && itemCode.toUpperCase() === 'AUGM06'
  const batValue = lot && lot !== 'na----' ? lot : ''
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="label-preview"
      style={{ margin: '0 auto' }}
    >
      <div className="lp-drug-col">
        <div className={`lp-drug ${isBlack ? 'lp-black' : ''}`}>{drugName}</div>
        {ipop === 'IP' && exp && exp !== 'na----' && (
          <div className="lp-expiry">Exp: {exp}</div>
        )}
      </div>
      <div className="lp-fields-col">
        <div className="lp-field">Bat. No.:<span className="lp-field-line">{batValue}</span></div>
        <div className="lp-field">Packed by:<span className="lp-field-line"></span></div>
        <div className="lp-field">Checked by:<span className="lp-field-line"></span></div>
      </div>
    </motion.div>
  )
}

function IPOPModal({ onSelect }) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ maxWidth: 320, textAlign: 'center' }}
      >
        <div className="modal-title">Select Label Type</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 13 }}>
          GTIN barcode detected. Choose label type:
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => onSelect('OP')}>Out-Patient (OP)</button>
          <button className="btn btn-success btn-lg" onClick={() => onSelect('IP')}>In-Patient (IP)</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function SmallLabelPrint({ navigate }) {
  const [tab, setTab] = useState('standard')
  const [input, setInput]           = useState('')
  const [shortExpInput, setShortExpInput] = useState('')
  const [drugName, setDrugName]     = useState('')
  const [ipop, setIpop]             = useState('')
  const [lot, setLot]               = useState('')
  const [exp, setExp]               = useState('')
  const [itemCode, setItemCode]     = useState('')
  const [showIPOP, setShowIPOP]     = useState(false)
  const [pendingBarcode, setPendingBarcode] = useState(null)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const inputRef   = useRef(null)
  const shortExpRef = useRef(null)

  useEffect(() => {
    if (tab === 'standard') inputRef.current?.focus()
    else shortExpRef.current?.focus()
  }, [tab])

  const clearLabel = () => {
    setDrugName(''); setIpop(''); setLot(''); setExp(''); setItemCode(''); setError('')
  }

  const resolveLabel = (code, ipopType, lotVal, expVal) => {
    const drug = findDrugByCode(code)
    if (!drug) { setError(`Item code not found: ${code}`); return }
    setDrugName(drug.name)
    setItemCode(drug.itemCode)
    setIpop(ipopType)
    setLot(lotVal || '')
    setExp(expVal || '')
    setError('')
  }

  const processInput = (raw) => {
    const val = raw.trim().toUpperCase()
    if (!val) return
    clearLabel()

    if (val.length === 6) {
      // 6-char item code → OP
      resolveLabel(val, 'OP', '', '')
    } else if (/^\d{8,}/.test(val)) {
      // Starts with digits → GTIN barcode
      const decoded = decodeBarcode(val)
      if (!decoded) { setError('Could not decode barcode'); return }
      // Extract item code: need DB lookup; for now show IP/OP modal
      setPendingBarcode({ decoded, rawBarcode: val })
      setShowIPOP(true)
    } else if (val.length === 13) {
      // 13-char IP barcode: extract chars 5-10 for item code
      const code = val.substring(4, 10)
      resolveLabel(code, 'IP', '', '')
    } else if (val.length > 6) {
      // Try extracting item code from pos 5-10 (IP format)
      const code = val.substring(4, 10)
      resolveLabel(code, 'IP', '', '')
    } else {
      setError('Unrecognised input. Enter a 6-char item code or scan a barcode.')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      processInput(input)
      setInput('')
    }
  }

  const handleIPOPSelect = (type) => {
    setShowIPOP(false)
    if (!pendingBarcode) return
    const { decoded } = pendingBarcode
    const [gtin, lotVal, expRaw] = decoded
    // Use GTIN as item code ref, but try to find drug by last 6 chars of GTIN
    const code = gtin ? gtin.substring(8, 14) : ''
    const expFormatted = expRaw && expRaw !== 'na----' ? formatExpiry(expRaw) : ''
    resolveLabel(code, type, lotVal !== 'na----' ? lotVal : '', expFormatted)
    setPendingBarcode(null)
  }

  const handlePrint = () => {
    if (!drugName) return
    const html = buildSmallLabelHTML(drugName, ipop, lot, exp, itemCode)
    printLabel(html, 1)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 1500)
    clearLabel()
    setInput('')
    if (tab === 'standard') inputRef.current?.focus()
  }

  // Short Exp tab
  const processShortExp = (code) => {
    const val = code.trim().toUpperCase()
    if (!val) return
    const drug = findDrugByCode(val)
    if (!drug) { setError(`Item code not found: ${val}`); return }
    const days = getExpAfterOpenDays(val)
    if (days === null) { setError('No expiry-after-open rule found for this item.'); return }
    const expDate = new Date()
    expDate.setDate(expDate.getDate() + parseInt(days, 10))
    const expStr = formatDateLabel(expDate)
    const batchNo = todayYYMMDD() + '01'
    setDrugName(drug.name)
    setItemCode(drug.itemCode)
    setIpop('IP')
    setLot(batchNo)
    setExp(expStr)
    setError('')
  }

  const handleShortExpKey = (e) => {
    if (e.key === 'Enter') {
      processShortExp(shortExpInput)
    }
  }

  return (
    <div className="page">
      {showIPOP && <IPOPModal onSelect={handleIPOPSelect} />}

      <div className="page-header">
        <button className="btn btn-back" onClick={() => navigate('menu')}>‹</button>
        <h1>Small Label Print</h1>
        {success && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ color: 'var(--success)', fontWeight: 700, fontSize: 14 }}
          >
            ✓ Printed!
          </motion.span>
        )}
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="tabs mb-12">
          <button className={`tab-btn ${tab === 'standard' ? 'active' : ''}`} onClick={() => { setTab('standard'); clearLabel(); }}>
            Standard Label
          </button>
          <button className={`tab-btn ${tab === 'shortexp' ? 'active' : ''}`} onClick={() => { setTab('shortexp'); clearLabel(); }}>
            Short Exp (After Opening)
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'standard' ? (
            <motion.div key="standard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="card">
                <div className="form-group">
                  <label className="form-label">Scan Barcode / Enter Item Code</label>
                  <input
                    ref={inputRef}
                    className="form-input large"
                    placeholder="Scan or type item code, then press Enter…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    autoFocus
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    6-char code → OP label · GTIN barcode → IP/OP selection · 13-char IP barcode → IP label
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: [0, -8, 8, -8, 0] }}
                      exit={{ opacity: 0 }}
                      style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, fontWeight: 600 }}
                    >
                      ⚠ {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {drugName && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 8 }}
                  >
                    <LabelPreview drugName={drugName} ipop={ipop} lot={lot} exp={exp} itemCode={itemCode} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{drugName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 2 }}>
                        Item Code: <strong>{itemCode}</strong>
                      </div>
                      <div style={{ marginBottom: 2 }}>
                        <span className={`badge ${ipop === 'OP' ? 'badge-info' : 'badge-success'}`}>{ipop} Label</span>
                      </div>
                      {exp && <div style={{ fontSize: 13, marginTop: 4 }}>Use before: <strong>{exp}</strong></div>}
                      {lot && lot !== 'na----' && <div style={{ fontSize: 13 }}>Batch: <strong>{lot}</strong></div>}
                      <div style={{ marginTop: 16 }}>
                        <button className="btn btn-primary" onClick={handlePrint}>🖨 Print Label</button>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={clearLabel}>Clear</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="shortexp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="card">
                <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                  ℹ For drugs opened from a vial/bottle — expiry is calculated from today based on pre-set rules.
                </div>
                <div className="form-group">
                  <label className="form-label">Item Code or Scan</label>
                  <input
                    ref={shortExpRef}
                    className="form-input large"
                    placeholder="Enter 6-char item code and press Enter…"
                    value={shortExpInput}
                    onChange={e => setShortExpInput(e.target.value)}
                    onKeyDown={handleShortExpKey}
                    autoComplete="off"
                  />
                </div>
                <button className="btn btn-primary" onClick={() => processShortExp(shortExpInput)} style={{ marginBottom: 12 }}>
                  Lookup
                </button>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, x: [0, -8, 8, -8, 0] }}
                      exit={{ opacity: 0 }}
                      style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}
                    >
                      ⚠ {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {drugName && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 8 }}
                  >
                    <LabelPreview drugName={drugName} ipop="IP" lot={lot} exp={exp} itemCode={itemCode} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{drugName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>IP Label · After Opening</div>
                      <div style={{ fontSize: 13, marginBottom: 2 }}>Use before: <strong>{exp}</strong></div>
                      <div style={{ fontSize: 13 }}>Batch: <strong>{lot}</strong></div>
                      <div style={{ marginTop: 16 }}>
                        <button className="btn btn-primary" onClick={handlePrint}>🖨 Print Label</button>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => { clearLabel(); setShortExpInput('') }}>Clear</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
