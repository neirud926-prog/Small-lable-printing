// EV54 pick list — A4 printout via hidden iframe + OS print dialog.
// Mirrors the iframe-based approach in labelPrint.js (_enqueueIframe), but
// uses an A4 page size and a tabular layout instead of a tiny label.

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildCSS() {
  return `
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 2pt solid #000; padding-bottom: 6pt; margin-bottom: 10pt;
    }
    h1 { font-size: 18pt; margin: 0; }
    .meta-right { font-size: 10pt; text-align: right; }
    .meta-row {
      display: flex; justify-content: space-between;
      font-size: 10pt; margin-bottom: 12pt;
    }
    .totals { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 11pt; }
    thead { display: table-header-group; }
    th, td {
      border: 1px solid #000; padding: 4pt 6pt;
      text-align: left; vertical-align: top;
      word-wrap: break-word;
    }
    th { background: #e8e8e8; font-weight: 700; }
    td.num  { text-align: right; font-variant-numeric: tabular-nums; }
    td.code { font-family: monospace; font-weight: 600; white-space: nowrap; }
    td.loc  { white-space: nowrap; font-size: 10pt; }
    td.loc .mobile { font-weight: 600; }
    col.col-num  { width: 6%; }
    col.col-code { width: 14%; }
    col.col-desc { width: 48%; }
    col.col-loc  { width: 18%; }
    col.col-qty  { width: 14%; }
    .container-line {
      margin-top: 10pt; font-size: 12pt; font-weight: 700;
    }
    .signature {
      margin-top: 20pt; display: flex; justify-content: space-between;
      font-size: 10pt;
    }
    .sig-field {
      flex: 1; margin: 0 8pt;
      border-top: 1pt solid #000; padding-top: 4pt; text-align: center;
    }
  `
}

// rows: [{ itemCode, name, mobileBin, location, quantity }]
// meta: { preparedBy, date, totals: { items, bottles, containers } }
export function buildPickListHTML(rows, meta) {
  const { preparedBy = '', date = '', totals = { items: 0, bottles: 0, containers: 0 } } = meta || {}

  const bodyRows = rows.map((r, i) => {
    const mobile = (r.mobileBin || '').trim()
    const shelf  = (r.location  || '').trim()
    let locCell = '—'
    if (mobile && shelf)      locCell = `<span class="mobile">${escapeHtml(mobile)}</span> / ${escapeHtml(shelf)}`
    else if (mobile)          locCell = `<span class="mobile">${escapeHtml(mobile)}</span>`
    else if (shelf)           locCell = escapeHtml(shelf)
    return `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="code">${escapeHtml(r.itemCode)}</td>
      <td>${escapeHtml(r.name || '')}</td>
      <td class="loc">${locCell}</td>
      <td class="num">${escapeHtml(r.quantity)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EV54 Pick List</title>
  <style>${buildCSS()}</style>
</head>
<body>
  <div class="header">
    <h1>EV54 Pick List</h1>
    <div class="meta-right">Date: <strong>${escapeHtml(date)}</strong></div>
  </div>

  <div class="meta-row">
    <div>Prepared by: <strong>${escapeHtml(preparedBy) || '________________'}</strong></div>
    <div class="totals">
      Items: ${totals.items} &middot; Bottles: ${totals.bottles}
    </div>
  </div>

  <table>
    <colgroup>
      <col class="col-num"/>
      <col class="col-code"/>
      <col class="col-desc"/>
      <col class="col-loc"/>
      <col class="col-qty"/>
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>Item Code</th>
        <th>Description</th>
        <th>Location</th>
        <th>Qty</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>

  <div class="container-line">
    Plastic Containers Required: ${totals.containers} (one container per drug line)
  </div>

  <div class="signature">
    <div class="sig-field">Collected by</div>
    <div class="sig-field">Checked by</div>
  </div>
</body>
</html>`
}

// Print via hidden iframe → window.print() → OS printer-selection dialog.
export function printPickList(rows, meta) {
  const html = buildPickListHTML(rows, meta)

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:none;'
  iframe.srcdoc = html

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch (e) {
      console.error('[pickListPrint] print failed:', e)
    }
    setTimeout(() => {
      try { document.body.removeChild(iframe) } catch (_) {}
    }, 1200)
  }

  document.body.appendChild(iframe)
}
