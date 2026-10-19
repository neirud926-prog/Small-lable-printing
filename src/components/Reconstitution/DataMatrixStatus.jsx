import React from 'react'

const TOO_BIG = 'The label text does not fit beside the 2D code at the current font sizes ' +
  '(Settings → Label Layout), so the 2D code will be left off.'

// One line under the label preview saying what the Internal GTIN 2D code on
// this label carries — or why it is left off. `fits` is the preview's check
// that all label text fits beside the code.
export default function DataMatrixStatus({ symbol, fits = true }) {
  if (!symbol) return null
  if (symbol.ok && !fits) {
    return <div style={{ fontSize: 12, color: 'var(--warning)' }}>⚠ {TOO_BIG}</div>
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

// The symbol to print: the 2D code only when it is ready and the label text
// fits beside it; otherwise none.
export function symbolToPrint(symbol, fits = true) {
  return symbol && symbol.ok && fits ? symbol : null
}

// Before printing: if the 2D code should be on the label but cannot be, say
// why and let staff choose. Returns false when they cancel.
export function confirmWithoutDataMatrix(symbol, fits = true) {
  if (!symbol || symbol.reason === 'disabled') return true
  if (symbol.ok && fits) return true
  const why = symbol.ok ? TOO_BIG : symbol.message
  return window.confirm(`${why}\n\nPrint the label without the 2D code?`)
}
