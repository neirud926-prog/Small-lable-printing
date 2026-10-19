import React, { useState, useEffect } from 'react'
import { getEV54Drugs, saveEV54Drugs, getDataPaths, getItemDescription } from '../../utils/storage'
import { loadEV54DrugsXls } from '../../utils/dataLoader'

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export default function EV54DrugsViewer() {
  const [rows, setRows]       = useState([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState('')

  function loadFromStorage() {
    // Description comes from the item list, not the EV54 file's own name column.
    const list = getEV54Drugs().map(r => {
      const d = getItemDescription(r.itemCode)
      return { ...r, desc: d.found ? d.description : '' }
    })
    const sorted = list.slice().sort((a, b) =>
      (a.evLocator || '').localeCompare(b.evLocator || '', undefined, { numeric: true, sensitivity: 'base' })
    )
    setRows(sorted)
    setStatus(`${sorted.length} EV54 drug${sorted.length !== 1 ? 's' : ''} loaded`)
  }

  useEffect(() => { loadFromStorage() }, [])

  async function handleReload() {
    const path = getDataPaths().ev54Drugs
    if (!path) { setStatus('No EV54 Drugs path configured in Settings.'); return }
    setLoading(true)
    setStatus('Reading Excel file…')
    try {
      const list = await loadEV54DrugsXls(path)
      saveEV54Drugs(list)
      loadFromStorage()
      setStatus(`Reloaded — ${list.length} drugs from file`)
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || String(e))
      setStatus(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const q = filter.trim().toUpperCase()
  const filtered = q
    ? rows.filter(r =>
        (r.itemCode  || '').toUpperCase().includes(q) ||
        (r.desc      || '').toUpperCase().includes(q) ||
        (r.evLocator || '').toUpperCase().includes(q))
    : rows

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="Filter by item code, description, or EV locator…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        {isTauri() && (
          <button className="btn btn-primary" onClick={handleReload} disabled={loading}>
            {loading ? '⏳ Loading…' : '🔄 Reload from File'}
          </button>
        )}
      </div>

      {status && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          {status}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>
          {rows.length === 0
            ? 'No EV54 Drugs data loaded. Configure the path in Settings → Data Sources and click "Reload from File".'
            : 'No results match your filter.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th>EV Locator</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.itemCode}-${i}`}>
                  <td><code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.itemCode}</code></td>
                  <td style={{ fontSize: 13 }}>
                    {r.desc || <span style={{ color: 'var(--warning)' }}>⚠ Not in item list</span>}
                  </td>
                  <td>
                    {r.evLocator ? (
                      <span style={{ fontSize: 12, background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                        🤖 {r.evLocator}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Showing {filtered.length} of {rows.length} entries
          </div>
        </div>
      )}
    </div>
  )
}
