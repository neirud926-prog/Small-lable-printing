import React, { useMemo, useState } from 'react'
import {
  getDrugs, getItemLocation, getGtinMap, getExpAfterOpenDays,
  getStockOnhand, getStockOnhandMeta,
} from '../utils/storage'
import Icon from './Icon'

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function fmtDDMMMYYYY(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  return `${dd}${MONTHS[d.getMonth()]}${d.getFullYear()}`
}
function fmtDDMMMYY(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}${MONTHS[d.getMonth()]}${yy}`
}
function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
function addDaysISO(days) {
  const d = new Date()
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() + days)
  // Use local-time components (toISOString() converts to UTC and would roll
  // back a day for any timezone east of UTC).
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function daysBetween(targetISO, fromISO) {
  const a = new Date(targetISO).getTime()
  const b = new Date(fromISO).getTime()
  return Math.round((a - b) / (1000 * 60 * 60 * 24))
}

const DAYS_40W = 280

export default function DrugEnquiry() {
  const [q, setQ]       = useState('')
  const [days, setDays] = useState('')

  const drugs = useMemo(() => getDrugs(), [])
  const stock = useMemo(() => getStockOnhand(), [])
  const stockMeta = useMemo(() => getStockOnhandMeta(), [])
  const gtinMap = useMemo(() => {
    const map = {}
    const raw = getGtinMap()
    Object.entries(raw).forEach(([gtin, item]) => {
      const code = (item || '').toString().toUpperCase()
      if (!map[code]) map[code] = gtin
    })
    return map
  }, [])

  const today = todayISO()
  const isStale = stockMeta.sourceDate !== today
  const ref40 = fmtDDMMMYYYY(addDaysISO(280))
  const ref26 = fmtDDMMMYYYY(addDaysISO(182))

  const daysNum = parseInt(days, 10)
  const daysValid = Number.isFinite(daysNum) && daysNum > 0
  const calcDate = daysValid ? fmtDDMMMYYYY(addDaysISO(daysNum)) : ''
  const calcWeeks = daysValid ? (daysNum / 7).toFixed(2) : ''

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
      {/* Reference-dates + day-calculator widget */}
      <div
        className="ds-card"
        style={{
          padding: '12px 16px', marginBottom: 12, display: 'flex',
          gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Reference dates:</span>
          <span><b>40 weeks:</b> <code style={{ fontFamily: 'var(--font-mono)' }}>{ref40}</code></span>
          <span style={{ color: 'var(--text-subtle)' }}>·</span>
          <span><b>26 weeks:</b> <code style={{ fontFamily: 'var(--font-mono)' }}>{ref26}</code></span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="day-calc" style={{ fontWeight: 600 }}>Days:</label>
          <input
            id="day-calc"
            type="number"
            min="1"
            step="1"
            value={days}
            onChange={e => setDays(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 100"
            style={{
              width: 90, padding: '4px 8px', border: '1px solid var(--border)',
              borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 13,
            }}
          />
          {daysValid && (
            <span style={{ color: 'var(--text)' }}>
              → <code style={{ fontFamily: 'var(--font-mono)' }}>{calcDate}</code>
              <span style={{ color: 'var(--text-subtle)', marginLeft: 6 }}>({calcWeeks} weeks)</span>
            </span>
          )}
        </div>
      </div>

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
              <th style={{ padding: '12px 16px' }}>Item code</th>
              <th style={{ padding: '12px 16px' }}>Drug name</th>
              <th style={{ padding: '12px 16px' }}>Location</th>
              <th style={{ padding: '12px 16px' }}>
                <div>Longest Exp</div>
                <div style={{
                  fontSize: 10, fontWeight: 500, marginTop: 2,
                  color: isStale ? 'var(--warning, #b45309)' : 'var(--text-subtle)',
                }}>
                  {stockMeta.sourceDate
                    ? (isStale
                        ? `⚠ stale — updated on ${fmtDDMMMYY(stockMeta.sourceDate)}`
                        : `updated on ${fmtDDMMMYY(stockMeta.sourceDate)}`)
                    : '— not loaded —'}
                </div>
              </th>
              <th style={{ padding: '12px 16px' }}>Exp after opening</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const code = d.itemCode.toUpperCase()
              const loc  = getItemLocation(code) || '—'
              const days = getExpAfterOpenDays(code)
              const s    = stock[code] || null
              const expDays = s?.expDate ? daysBetween(s.expDate, today) : null
              const isExpiring = expDays !== null && expDays < DAYS_40W
              const rowStyle = isExpiring
                ? { background: 'rgba(220, 38, 38, 0.08)' }
                : undefined
              return (
                <tr key={`${code}-${i}`} style={rowStyle}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{d.itemCode}</td>
                  <td style={{ padding: '12px 16px' }}>{d.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', padding: '2px 8px', borderRadius: 99,
                      font: '600 11px var(--font-mono)',
                      background: loc === '—' ? 'var(--neutral-100)' : 'var(--primary-50)',
                      color:      loc === '—' ? 'var(--text-subtle)' : 'var(--primary-800)',
                    }}>{loc}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {s ? (
                      <span style={isStale ? { filter: 'blur(3px)' } : undefined}>
                        {isExpiring && (
                          <span title={`Expires in ${expDays} days`} style={{ color: 'var(--danger, #b91c1c)', marginRight: 4 }}>⚠</span>
                        )}
                        <b style={{ color: isExpiring ? 'var(--danger, #b91c1c)' : 'inherit' }}>{fmtDDMMMYYYY(s.expDate)}</b>
                        <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 2 }}>
                          {s.lot ? `lot ${s.lot}` : ''}
                          {s.qty != null ? `${s.lot ? ' · ' : ''}${s.qty}${s.unit ? ' ' + s.unit : ''}` : ''}
                        </div>
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{days ? `${days} d` : '—'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)' }}>
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
