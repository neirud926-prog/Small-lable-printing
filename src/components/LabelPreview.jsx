import React, { useMemo } from 'react'
import {
  buildSmallLabelHTML,
  buildFullPageHTML,
  buildReconstitutionLabelHTML,
  buildReconstitutionFullPageHTML,
} from '../utils/labelPrint'
import { getItemDescription } from '../utils/storage'

const FALLBACK_NAME = 'VALPROATE SODIUM SOLUTION 200MG/5ML'

export default function LabelPreview({
  settings,
  type = 'small',
  itemCode = '',
  batchNo = 'ABC-12345678',
  expiry = 'dd-mmm-yyyy',
  scale = 4,
  label,
}) {
  const w = settings.labelWidth  || 34.4
  const h = settings.labelHeight || 25

  const code = (itemCode || '').trim()
  // Sample name only when no code is typed; otherwise the item-list description
  // (or the code itself when it is not in the item list).
  const drugName = code ? getItemDescription(code).description : FALLBACK_NAME

  const srcDoc = useMemo(() => {
    if (type === 'recon') {
      const body = buildReconstitutionLabelHTML(batchNo, expiry, settings, code)
      return buildReconstitutionFullPageHTML(body, settings)
    }
    const body = buildSmallLabelHTML(drugName, 'IP', batchNo, expiry, code, settings)
    return buildFullPageHTML(body, settings)
  }, [type, settings, drugName, code, batchNo, expiry])

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
            title={`label-preview-${type}`}
            srcDoc={srcDoc}
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
