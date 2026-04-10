import React, { useState } from 'react'
import { getBatchRecords } from '../../utils/storage'

export default function BatchHistory() {
  const [search, setSearch]       = useState('')
  const [filterStatus, setStatus] = useState('All')
  const [filterLoc, setLoc]       = useState('All')
  const [fromDate, setFrom]       = useState('')
  const [toDate, setTo]           = useState('')

  const all = getBatchRecords()

  const filtered = all.filter(r => {
    const q = search.toUpperCase()
    const matchSearch = !q || r.itemCode.toUpperCase().includes(q) || r.batchNo.toUpperCase().includes(q)
    const matchStatus = filterStatus === 'All' || r.status === filterStatus
    const matchLoc    = filterLoc === 'All' || r.location === filterLoc
    const matchFrom   = !fromDate || r.date >= fromDate
    const matchTo     = !toDate   || r.date <= toDate
    return matchSearch && matchStatus && matchLoc && matchFrom && matchTo
  })

  return (
    <div className="card">
      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        <input className="form-input" placeholder="Search item/batch…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={filterStatus} onChange={e => setStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="In Use">In Use</option>
          <option value="Cancel Order">Cancelled</option>
        </select>
        <select className="form-select" value={filterLoc} onChange={e => setLoc(e.target.value)}>
          <option value="All">All Locations</option>
          <option value="EC">EC</option>
          <option value="IPOP">IP/OP</option>
        </select>
        <input className="form-input" type="date" value={fromDate} onChange={e => setFrom(e.target.value)} title="From date" />
        <input className="form-input" type="date" value={toDate} onChange={e => setTo(e.target.value)} title="To date" />
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        Showing {filtered.length} of {all.length} records
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">No records found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Location</th>
                <th>Item Code</th>
                <th>Batch No.</th>
                <th>Expiry</th>
                <th>Labels</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12 }}>{r.date}</td>
                  <td><span className={`badge ${r.location === 'EC' ? 'badge-warning' : 'badge-info'}`}>{r.location}</span></td>
                  <td><code style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.itemCode}</code></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.batchNo}</td>
                  <td style={{ fontSize: 12 }}>{r.expiry}</td>
                  <td style={{ fontSize: 12, textAlign: 'center' }}>{r.labelCount}</td>
                  <td>
                    <span className={`badge ${r.status === 'In Use' ? 'badge-success' : 'badge-danger'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
