import React, { useMemo, useState } from 'react'
import {
  buildLabelDataMatrix, isLabelDataMatrixEnabled, symbolPrintDecision, TEXT_TOO_BIG_MESSAGE,
} from '../../utils/labelDataMatrix'
import { packVolumeDigitForRecord } from '../../utils/internalGtin'

/**
 * Internal GTIN 2D code for a Prepack / ABX / Extemp label (issue #32),
 * shared by the three Reconstitution tabs.
 *
 *   symbol         buildLabelDataMatrix() result for the label as it will print,
 *                  or null while there is no item / batch number / Use Before yet
 *   previewSymbol  the symbol to show in <LabelPreview>, or null
 *   fits           the preview's check that all label text fits beside the
 *                  symbol: true / false, or null until the current preview has
 *                  been measured
 *   onFit          pass to <LabelPreview onFit>
 *   prepare        call when printing → { ok, symbol, error? }: the symbol to
 *                  print (null = print without it). Asks staff first when the
 *                  code should be on the label but cannot be; ok: false means
 *                  do not print.
 */
export function useLabelDataMatrix({ itemCode, record, expiryText, lot, settings, region = 'bottom' }) {
  const [fits, setFits] = useState(null)
  const enabled = isLabelDataMatrixEnabled(settings)
  const widthMm = settings.labelWidth || 34.4
  const heightMm = settings.labelHeight || 25
  const packVolumeDigit = packVolumeDigitForRecord(record)

  // Keyed on plain values: the settings object and the record are re-read
  // from storage on every render.
  const symbol = useMemo(() => {
    if (!itemCode || !lot || !expiryText) return null
    return buildLabelDataMatrix({
      itemCode, record, expiryText, lot, region,
      settings: { labelDataMatrix: enabled, labelWidth: widthMm, labelHeight: heightMm },
    })
  }, [itemCode, packVolumeDigit, expiryText, lot, region, enabled, widthMm, heightMm])

  const prepare = () => {
    const { action, message } = symbolPrintDecision(symbol, fits)
    if (action === 'print') return { ok: true, symbol }
    if (action === 'none') return { ok: true, symbol: null }
    if (action === 'wait') return { ok: false, error: message }
    if (!window.confirm(`${message}\n\nPrint the label without the 2D code?`)) return { ok: false }
    return { ok: true, symbol: null }
  }

  return { symbol, previewSymbol: symbol && symbol.ok ? symbol : null, fits, onFit: setFits, prepare }
}

// One line under the label preview saying what the Internal GTIN 2D code on
// this label carries — or why it is left off.
export default function DataMatrixStatus({ symbol, fits }) {
  if (!symbol) return null
  if (symbol.ok && fits === false) {
    return <div style={{ fontSize: 12, color: 'var(--warning)' }}>⚠ {TEXT_TOO_BIG_MESSAGE}</div>
  }
  if (symbol.ok) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        2D code: <code style={{ fontFamily: 'var(--font-mono, monospace)' }}>{symbol.hri}</code>
      </div>
    )
  }
  if (symbol.reason === 'disabled') {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        2D code turned off (Settings → Label Layout).
      </div>
    )
  }
  return (
    <div style={{ fontSize: 12, color: 'var(--warning)' }}>
      ⚠ No 2D code on this label: {symbol.message}
    </div>
  )
}
