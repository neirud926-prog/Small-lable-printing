// Label printing via hidden iframe → window.print()
// Label size: 34.4mm × 25mm (landscape) — configurable via settings

export function printLabel(labelHTML, copies = 1, settings = {}) {
  const w   = settings.labelWidth    || 34.4
  const h   = settings.labelHeight   || 25
  const pt  = settings.labelPadTop   || 1.8
  const pb  = settings.labelPadBottom|| 1.4
  const pl  = settings.labelPadLeft  || 2.2
  const pr  = settings.labelPadRight || 2.2
  const ff  = settings.fontFamily    || 'Arial'
  const dfs = settings.drugFontSize  || 8.5
  const dfb = settings.drugFontBold  !== false
  const bfs = settings.batchFontSize || 6
  const sfs = settings.signFontSize  || 5.5

  for (let i = 0; i < copies; i++) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${w}mm;height:${h}mm;border:none;`
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: ${w}mm ${h}mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${w}mm;
    height: ${h}mm;
    font-family: ${ff}, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: ${pt}mm ${pr}mm ${pb}mm ${pl}mm;
  }
  /* Drug name — fills available space, centred */
  .label-drug {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: ${dfs}pt;
    font-weight: ${dfb ? 'bold' : 'normal'};
    word-break: break-word;
    line-height: 1.25;
  }
  .label-drug.small-font { font-size: ${Math.max(dfs - 1.5, 5)}pt; }
  .label-drug.black-bg {
    background: black;
    color: white;
    border-radius: 0.8mm;
    padding: 0 1mm;
  }
  /* Expiry line (IP labels) */
  .label-exp {
    font-size: ${Math.max(sfs - 0.5, 4)}pt;
    text-align: center;
    padding-bottom: 0.5mm;
  }
  /* Bat. No. — full-width underline */
  .label-bat {
    display: flex;
    align-items: baseline;
    font-size: ${bfs}pt;
    font-weight: bold;
    margin-top: 1.2mm;
  }
  .label-bat-line {
    flex: 1;
    border-bottom: 0.25mm solid #000;
    margin-left: 0.8mm;
    height: 3mm;
    font-weight: normal;
    font-size: ${bfs}pt;
    line-height: 2.8mm;
    padding-left: 0.5mm;
  }
  /* Packed by / Checked by — side by side */
  .label-footer {
    display: flex;
    gap: 2mm;
    margin-top: 1mm;
    font-size: ${sfs}pt;
    font-weight: bold;
  }
  .label-footer-item {
    display: flex;
    align-items: baseline;
    flex: 1;
  }
  .label-footer-line {
    flex: 1;
    border-bottom: 0.25mm solid #000;
    margin-left: 0.5mm;
    height: 3mm;
  }
  @media print {
    html, body { width: ${w}mm; height: ${h}mm; }
  }
</style>
</head>
<body>
${labelHTML}
</body>
</html>`)
    doc.close()

    iframe.contentWindow.focus()
    setTimeout(() => {
      iframe.contentWindow.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 200)
  }
}

// Build small label HTML — landscape 34.4mm × 25mm
// Layout (stacked):
//   ┌─ drug name (centred, flex 1) ─┐
//   │ Bat. No.: ___________________  │
//   │ Packed by: ___  Checked by: __ │
//   └───────────────────────────────┘
export function buildSmallLabelHTML(drugName, ipop, lot, exp, itemCode, settings = {}) {
  const isAUGM06 = itemCode && itemCode.toUpperCase() === 'AUGM06'
  const isPHEN18 = itemCode && itemCode.toUpperCase() === 'PHEN18'

  const drugClass = [
    'label-drug',
    isAUGM06 ? 'black-bg' : '',
    isPHEN18 ? 'small-font' : '',
  ].filter(Boolean).join(' ')

  const batValue = lot && lot !== 'na----' ? lot : ''
  const expRow = ipop === 'IP' && exp && exp !== 'na----'
    ? `<div class="label-exp">Exp: ${exp}</div>`
    : ''

  return `
    <div class="${drugClass}">${drugName}</div>
    ${expRow}
    <div class="label-bat">Bat. No.:<span class="label-bat-line">${batValue}</span></div>
    <div class="label-footer">
      <div class="label-footer-item">Packed by:<span class="label-footer-line"></span></div>
      <div class="label-footer-item">Checked by:<span class="label-footer-line"></span></div>
    </div>
  `
}

// Build ABX/OPLabel (3-column layout matching OPLabel sheet)
export function buildAbxLabelHTML(drugName, batchNo, expiry, itemCode, settings = {}) {
  const isAUGM06 = itemCode && itemCode.toUpperCase() === 'AUGM06'
  const drugStyle = isAUGM06 ? 'background:black;color:white;' : ''
  const dfs = settings.drugFontSize || 8
  const bfs = settings.batchFontSize || 7
  const col = `
    <div style="flex:1;padding:1mm;${drugStyle}">
      <div style="font-size:${dfs}pt;font-weight:bold;min-height:12mm;display:flex;align-items:center;justify-content:center;text-align:center;">${drugName}</div>
      <div style="font-size:${bfs}pt;margin-top:1mm;">Batch No:<br/><span style="font-size:${bfs + 2}pt;font-weight:bold;">${batchNo}</span></div>
      <div style="font-size:${bfs}pt;margin-top:1mm;">Use Before:<br/><span style="font-size:${bfs + 4}pt;font-weight:bold;">${expiry}</span></div>
    </div>
  `
  return `<div style="display:flex;width:100%;height:100%;">${col}${col}${col}</div>`
}

// Build Extemp / EC label HTML
export function buildExtempLabelHTML(description, batchNo, expiry, storage, warning, note, settings = {}) {
  const dfs = settings.drugFontSize  || 8
  const bfs = settings.batchFontSize || 7
  return `
    <div style="font-size:${dfs}pt;font-weight:bold;text-align:center;padding:1mm;">${description}</div>
    <div style="font-size:${bfs}pt;margin-top:1mm;">Batch No.: <strong>${batchNo}</strong></div>
    <div style="font-size:${bfs}pt;margin-top:0.5mm;">Use Before: <strong>${expiry}</strong></div>
    ${storage ? `<div style="font-size:${bfs}pt;margin-top:0.5mm;">${storage}</div>` : ''}
    ${warning ? `<div style="font-size:${bfs}pt;margin-top:0.5mm;">${warning}</div>` : ''}
    ${note ? `<div style="font-size:${Math.max(bfs - 1, 5)}pt;margin-top:0.5mm;">${note}</div>` : ''}
  `
}

// Build Prepack label HTML
export function buildPrepackLabelHTML(description, batchNo, expiry, settings = {}) {
  const dfs = settings.drugFontSize  || 8
  const bfs = settings.batchFontSize || 7
  return `
    <div style="font-size:${dfs}pt;font-weight:bold;text-align:center;padding:1mm;">${description}</div>
    <div style="font-size:${bfs}pt;margin-top:1mm;">Batch No: <strong>${batchNo}</strong></div>
    <div style="font-size:${bfs}pt;margin-top:0.5mm;">Use Before: <strong>${expiry}</strong></div>
  `
}
