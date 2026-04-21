import React, { useMemo, useState } from 'react'
import { getDrugs, getItemLocation, getGtinMap, getExpAfterOpenDays } from '../utils/storage'
import Icon from './Icon'

export default function DrugEnquiry({ initialQuery = '' }) {
  const [q, setQ] = useState(initialQuery)

  // Sync when App.jsx pushes a new search from the topbar
  React.useEffect(() => {
    if (initialQuery) setQ(initialQuery)
  }, [initialQuery])

  const drugs = useMemo(() => getDrugs(), [])
  const gtinMap = useMemo(() => {
    const map = {}
    const raw = getGtinMap()
    Object.entries(raw).forEach(([gtin, item]) => {
      const code = (item || '').toString().toUpperCase()
      if (!map[code]) map[code] = gtin
    })
    return map
  }, [])

  const filtered = useMemo(() => {
    const v = q.trim().toUpperCase()
    if (!v) return drugs.slice(0, 200)
    return drugs.filter(d =>
      d.itemCode.toUpperCase().includes(v) ||
      (d.name || '').toUpperCase().includes(v) ||
      (gtinMap[d.itemCode.toUpperCase()] || '').includes(v)
    ).slice(0, 200)
  }, [q, drugs, gtinMap])

  return (
    <div>
      <div className="ds-card" style={{ padding: '16px 18px' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 16, top: 18, color: 'var(--text-subtle)' }}>
            <Icon name="search" size={20} />
          </div>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search drug name, item code, or GTIN…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '16px 16px 16px 48px',
              border: '1px solid var(--border)', borderRadius: 12,
              font: '500 16px var(--font)', outline: 'none',
              background: 'var(--surface2)', color: 'var(--text)',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: 12, color: 'var(--text-subtle)' }}>
          <span>{filtered.length} of {drugs.length} drugs</span>
          <span>·</span>
          <span>Read-only — for printing, use <b style={{ color: 'var(--text-muted)' }}>Small Label Print</b></span>
        </div>
      </div>

      <div className="ds-card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              {['Item code', 'Drug name', 'Unit', 'Location', 'GTIN', 'Exp after opening'].map(h => (
                <th key={h} style={{ padding: '12px 16px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const code = d.itemCode.toUpperCase()
              const loc  = getItemLocation(code) || '—'
              const gtin = gtinMap[code] || '—'
              const days = getExpAfterOpenDays(code)
              return (
                <tr key={`${code}-${i}`}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{d.itemCode}</td>
                  <td style={{ padding: '12px 16px' }}>{d.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-subtle)' }}>{d.unit || ''}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', padding: '2px 8px', borderRadius: 99,
                      font: '600 11px var(--font-mono)',
                      background: loc === '—' ? 'var(--neutral-100)' : 'var(--primary-50)',
                      color:      loc === '—' ? 'var(--text-subtle)' : 'var(--primary-800)',
                    }}>{loc}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)' }}>{gtin}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{days ? `${days} d` : '—'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)' }}>
                {drugs.length === 0
                  ? 'No drugs loaded. Import drug data in Maintenance.'
                  : `No drugs match "${q}"`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
