import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getGtinMap, saveGtinMap, getDataPaths, findDrugByCode } from '../../utils/storage'

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export default function GtinViewer() {
  const [rows, setRows]       = useState([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState('')

  // Build sorted row array from the stored GTIN map
  function loadFromStorage() {
    const map = getGtinMap()
    const arr = Object.entries(map)
      .map(([gtin, itemCode]) => {
        const drug = findDrugByCode(itemCode)
        return { gtin, itemCode, drugName: drug ? drug.name : '' }
      })
      .sort((a, b) => a.itemCode.localeCompare(b.itemCode))
    setRows(arr)
    setStatus(`${arr.length} GTIN${arr.length !== 1 ? 's' : ''} loaded from storage`)
  }

  useEffect(() => { loadFromStorage() }, [])

  async function handleReload() {
    const path = getDataPaths().gtin
    if (!path) { setStatus('No GTIN database path configured in Settings.'); return }
    setLoading(true)
    setStatus('Connecting to database…')
    try {
      const records = await invoke('query_gtin_db', { path })
      const map = {}
      for (const r of records) {
        if (r.GTIN && r.ItemCode)
          map[r.GTIN.toString().trim()] = r.ItemCode.toString().trim().toUpperCase()
      }
      saveGtinMap(map)
      loadFromStorage()
      setStatus(`Reloaded — ${Object.keys(map).length} GTINs from database`)
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || String(e))
      setStatus(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const q = filter.trim().toUpperCase()
  const filtered = q
    ? rows.filter(r => r.gtin.includes(q) || r.itemCode.includes(q) || r.drugName.toUpperCase().includes(q))
    : rows

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="Filter by GTIN, item code, or drug name…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        {isTauri() && (
          <button className="btn btn-primary" onClick={handleReload} disabled={loading}>
            {loading ? '⏳ Loading…' : '🔄 Reload from DB'}
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
            ? 'No GTIN data loaded. Configure the GTIN database path in Settings and click "Reload from DB".'
            : 'No results match your filter.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>GTIN</th>
                <th>Item Code</th>
                <th>Drug Name</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.gtin}>
                  <td><code style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.gtin}</code></td>
                  <td><code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.itemCode}</code></td>
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
