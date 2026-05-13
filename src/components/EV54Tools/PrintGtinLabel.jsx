import React, { useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import QRCode from 'qrcode'
import { findDrugByCode, findGtinByCode, getSettings, findByGtin } from '../../utils/storage'
import { classifyScannedInput, itemCodeFromDecodedGtin } from '../../utils/barcodeDecoder'

export default function PrintGtinLabel() {
  const [itemCode, setItemCode]   = useState('')
  const [quantity, setQuantity]   = useState(1)
  const [drug, setDrug]           = useState(null)
  const [gtin, setGtin]           = useState(null)
  const [status, setStatus]       = useState('idle')  // idle | printing | done | error
  const [errorMsg, setErrorMsg]   = useState('')
  const inputRef = useRef(null)

  const reset = () => {
    setDrug(null); setGtin(null); setStatus('idle'); setErrorMsg('')
  }

  // Accept any of: 6-char item code · 13-char IP barcode · GTIN barcode.
  // All paths resolve to a single (drug, gtin) pair for the QR label.
  const resolveFromCode = (code) => {
    const d = findDrugByCode(code)
    const g = d ? findGtinByCode(code) : null
    setDrug(d || null)
    setGtin(g || null)
    if (!d)      setErrorMsg(`Item code not found in drug list: ${code}`)
    else if (!g) setErrorMsg('No GTIN found for this item code. Check GTIN map in Maintenance.')
  }

  const handleCodeChange = (val) => {
    const v = val.toUpperCase()
    setItemCode(v)
    setStatus('idle'); setErrorMsg('')
    const c = classifyScannedInput(val, getSettings().barcodeMethod || 'gs1')
    switch (c.kind) {
      case 'op-code':
      case 'ip-code':
        resolveFromCode(c.itemCode)
        break
      case 'gtin': {
        const code = itemCodeFromDecodedGtin(c.decoded, findByGtin)
        if (!code) { setDrug(null); setGtin(null); setErrorMsg('Could not resolve item code from scanned GTIN.'); break }
        // Use the GTIN we just scanned directly — no need to round-trip through findGtinByCode
        const d = findDrugByCode(code)
        setDrug(d || null)
        setGtin(c.decoded[0] || null)
        if (!d) setErrorMsg(`Item code not found in drug list: ${code}`)
        break
      }
      default:
        setDrug(null); setGtin(null)
    }
  }

  const handlePrint = async () => {
    if (!drug || !gtin) return
    setStatus('printing'); setErrorMsg('')
    try {
      const settings = getSettings()

      // Generate QR code as base64 PNG (error-correction L = most compact)
      const dataUrl = await QRCode.toDataURL(gtin, {
        errorCorrectionLevel: 'L',
        margin: 0,
        width: 200,
        color: { dark: '#000000', light: '#ffffff' },
      })
      const imageBase64 = dataUrl.replace(/^data:image\/png;base64,/, '')

      for (let i = 0; i < quantity; i++) {
        await invoke('print_gtin_label', {
          imageBase64,
          itemCode:       drug.itemCode,
          printerName:    settings.printerName          || 'Thermal GX420t - PMS',
          widthMm:        settings.labelWidth           || 34.4,
          heightMm:       settings.labelHeight          || 25,
          qrSizeMm:       settings.gtinQrSizeMm         ?? 0,
          itemCodeFontPt: settings.gtinItemCodeFontSize ?? 5,
        })
      }

      setStatus('done')
      setTimeout(() => {
        setStatus('idle')
        setItemCode(''); setDrug(null); setGtin(null); setQuantity(1)
        inputRef.current?.focus()
      }, 1500)
    } catch (err) {
      setStatus('error')
      setErrorMsg(String(err))
    }
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
        Prints a QR code label containing the GTIN, with the item code below.
        Uses the same printer and paper size as the small label.
      </div>

      <div className="form-group">
        <label className="form-label">Item Code or Scan</label>
        <input
          ref={inputRef}
          className="form-input"
          style={{ width: 280, fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}
          placeholder="6-char code · 13-char IP barcode · GTIN"
          value={itemCode}
          onChange={e => handleCodeChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && drug && gtin && handlePrint()}
          autoFocus
          autoComplete="off"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Quantity</label>
        <input
          className="form-input"
          type="number"
          min={1}
          max={99}
          style={{ width: 80 }}
          value={quantity}
          onChange={e => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
        />
      </div>

      {/* Preview */}
      {drug && gtin && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{drug.name}</div>
          <div style={{ color: 'var(--text-muted)' }}>
            Item Code: <strong>{drug.itemCode}</strong>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            GTIN: <strong style={{ fontFamily: 'monospace' }}>{gtin}</strong>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
          ⚠ {errorMsg}
        </div>
      )}

      {status === 'done' && (
        <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12, fontWeight: 700 }}>
          ✓ {quantity} label{quantity > 1 ? 's' : ''} printed!
        </div>
      )}

      <button
        className="btn btn-primary"
        disabled={!drug || !gtin || status === 'printing'}
        onClick={handlePrint}
      >
        {status === 'printing' ? 'Printing…' : `🖨 Print ${quantity > 1 ? `${quantity} Labels` : 'Label'}`}
      </button>

      {(drug || itemCode) && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 8 }}
          onClick={() => { setItemCode(''); setQuantity(1); reset(); inputRef.current?.focus() }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
