import React, { useState, useEffect } from 'react'
import {
  getMobileShelf, saveMobileShelf, getDataPaths, findDrugByCode,
} from '../../utils/storage'
import { loadMobileShelfXls } from '../../utils/dataLoader'

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export default function MobileShelfViewer() {
  const [rows, setRows]       = useState([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState('')

  function loadFromStorage() {
    const map = getMobileShelf()
    const arr = Object.entries(map)
      .map(([itemCode, bin]) => {
        const drug = findDrugByCode(itemCode)
        return { itemCode, bin, drugName: drug ? drug.name : '' }
      })
      .sort((a, b) => a.bin.localeCompare(b.bin, undefined, { numeric: true, sensitivity: 'base' }))
    setRows(arr)
    setStatus(`${arr.length} Mobile Shelf entr${arr.length !== 1 ? 'ies' : 'y'} loaded`)
  }

  useEffect(() => { loadFromStorage() }, [])

  async function handleReload() {
    const path = getDataPaths().mobileShelf
    if (!path) { setStatus('No Mobile Shelf path configured in Settings.'); return }
    setLoading(true)
    setStatus('Reading Excel file…')
    try {
      const map = await loadMobileShelfXls(path)
      saveMobileShelf(map)
      loadFromStorage()
      setStatus(`Reloaded — ${Object.keys(map).length} entries from file`)
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || String(e))
      setStatus(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const q = filter.trim().toUpperCase()
  const filtered = q
    ? rows.filter(r => r.itemCode.includes(q) || r.bin.toUpperCase().includes(q) || r.drugName.toUpperCase().includes(q))
    : rows

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="Filter by item code, bin, or drug name…"
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
            ? 'No Mobile Shelf data loaded. Configure the path in Settings → Data Sources and click "Reload from File".'
            : 'No results match your filter.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Bin No.</th>
                <th>Drug Name</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.itemCode}>
                  <td><code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.itemCode}</code></td>
                  <td>
                    <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                      🟢 {r.bin}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: r.drugName ? 'inherit' : 'var(--text-muted)' }}>
                    {r.drugName || '—'}
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
