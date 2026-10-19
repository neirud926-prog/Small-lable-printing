import React, { useMemo, useRef } from 'react'
import {
  buildSmallLabelHTML,
  buildFullPageHTML,
  buildReconstitutionLabelHTML,
  buildReconstitutionFullPageHTML,
  buildPrepackLabelHTML,
  buildExtempLabelHTML,
  labelTextFits,
} from '../utils/labelPrint'
import { getItemDescription } from '../utils/storage'

const FALLBACK_NAME = 'VALPROATE SODIUM SOLUTION 200MG/5ML'

// Renders a label exactly as it prints — same HTML builders and page CSS as
// the print paths — scaled up in an iframe.
//   type: 'small' | 'recon' | 'prepack' | 'extemp'
//   symbol: optional buildLabelDataMatrix() result (recon / prepack / extemp)
//   onFit:  optional callback(fits) — after each render, whether all label text
//           fits on the label (and clear of the 2D code)
export default function LabelPreview({
  settings,
  type = 'small',
  itemCode = '',
  batchNo = 'ABC-12345678',
  expiry = 'dd-mmm-yyyy',
  description,
  storage = '',
  warning = '',
  symbol = null,
  scale = 4,
  label,
  onFit,
}) {
  const iframeRef = useRef(null)
  const w = settings.labelWidth  || 34.4
  const h = settings.labelHeight || 25

  const code = (itemCode || '').trim()
  // Sample name only when no code is typed; otherwise the item-list description
  // (or the code itself when it is not in the item list).
  const drugName = description ?? (code ? getItemDescription(code).description : FALLBACK_NAME)

  const srcDoc = useMemo(() => {
    if (type === 'recon') {
      const body = buildReconstitutionLabelHTML(batchNo, expiry, settings, code, symbol)
      return buildReconstitutionFullPageHTML(body, settings)
    }
    if (type === 'prepack') {
      return buildFullPageHTML(buildPrepackLabelHTML(drugName, batchNo, expiry, settings, symbol), settings)
    }
    if (type === 'extemp') {
      return buildFullPageHTML(buildExtempLabelHTML(drugName, batchNo, expiry, storage, warning, '', settings, symbol), settings)
    }
    const body = buildSmallLabelHTML(drugName, 'IP', batchNo, expiry, code, settings)
    return buildFullPageHTML(body, settings)
  }, [type, settings, drugName, code, batchNo, expiry, storage, warning, symbol])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {label}
        </div>
      )}
      <div style={{
        display: 'inline-flex',
        padding: 6,
        background: 'repeating-conic-gradient(#f3f4f6 0% 25%, #fff 25% 50%) 0 0/12px 12px',
        borderRadius: 6, border: '1px solid var(--border)',
      }}>
        <div style={{
          width:  `calc(${w}mm * ${scale})`,
          height: `calc(${h}mm * ${scale})`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          background: '#fff',
          overflow: 'hidden',
        }}>
          <iframe
            ref={iframeRef}
            title={`label-preview-${type}`}
            srcDoc={srcDoc}
            onLoad={() => {
              if (!onFit) return
              try { onFit(labelTextFits(iframeRef.current.contentDocument)) } catch { onFit(true) }
            }}
            style={{
              border: 'none',
              width:  `${w}mm`,
              height: `${h}mm`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  )
}
