// Label printing via hidden iframe → window.print()
// Label size: 34.4mm × 25mm (landscape)

export function printLabel(labelHTML, copies = 1) {
  for (let i = 0; i < copies; i++) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:34.4mm;height:25mm;border:none;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: 34.4mm 25mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 34.4mm;
    height: 25mm;
    font-family: Arial, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: row;
  }
  /* Left column: drug name */
  .label-drug-col {
    flex: 0 0 56%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5mm;
    border-right: 0.3mm solid #000;
  }
  .label-drug {
    font-size: 9pt;
    font-weight: bold;
    text-align: center;
    word-break: break-word;
    line-height: 1.2;
  }
  .label-drug.small-font { font-size: 7pt; }
  .label-drug.black-bg {
    background: black;
    color: white;
    padding: 1mm;
    border-radius: 1mm;
  }
  .label-exp {
    font-size: 5.5pt;
    text-align: center;
    margin-top: 1mm;
    width: 100%;
  }
  /* Right column: form fields */
  .label-fields-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    padding: 1mm 1.5mm;
  }
  .label-field {
    font-size: 5.5pt;
    font-weight: bold;
    line-height: 1;
  }
  .label-field-line {
    display: block;
    border-bottom: 0.25mm solid #000;
    width: 100%;
    margin-top: 0.8mm;
    min-height: 2.5mm;
    font-weight: normal;
    font-size: 5.5pt;
  }
  @media print {
    html, body { width: 34.4mm; height: 25mm; }
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
// Layout: drug name (left col) | Bat.No. / Packed by / Checked by (right col)
export function buildSmallLabelHTML(drugName, ipop, lot, exp, itemCode) {
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
    <div class="label-drug-col">
      <div class="${drugClass}">${drugName}</div>
      ${expRow}
    </div>
    <div class="label-fields-col">
      <div class="label-field">Bat. No.:<span class="label-field-line">${batValue}</span></div>
      <div class="label-field">Packed by:<span class="label-field-line"></span></div>
      <div class="label-field">Checked by:<span class="label-field-line"></span></div>
    </div>
  `
}

// Build ABX/OPLabel (3-column layout matching OPLabel sheet)
export function buildAbxLabelHTML(drugName, batchNo, expiry, itemCode) {
  const isAUGM06 = itemCode && itemCode.toUpperCase() === 'AUGM06'
  const drugStyle = isAUGM06 ? 'background:black;color:white;' : ''
  const col = `
    <div style="flex:1;padding:1mm;${drugStyle}">
      <div style="font-size:8pt;font-weight:bold;min-height:12mm;display:flex;align-items:center;justify-content:center;text-align:center;">${drugName}</div>
      <div style="font-size:7pt;margin-top:1mm;">Batch No:<br/><span style="font-size:9pt;font-weight:bold;">${batchNo}</span></div>
      <div style="font-size:7pt;margin-top:1mm;">Use Before:<br/><span style="font-size:11pt;font-weight:bold;">${expiry}</span></div>
    </div>
  `
  return `<div style="display:flex;width:100%;height:100%;">${col}${col}${col}</div>`
}

// Build Extemp / EC label HTML
export function buildExtempLabelHTML(description, batchNo, expiry, storage, warning, note) {
  return `
    <div style="font-size:8pt;font-weight:bold;text-align:center;padding:1mm;">${description}</div>
    <div style="font-size:7pt;margin-top:1mm;">Batch No.: <strong>${batchNo}</strong></div>
    <div style="font-size:7pt;margin-top:0.5mm;">Use Before: <strong>${expiry}</strong></div>
    ${storage ? `<div style="font-size:7pt;margin-top:0.5mm;">${storage}</div>` : ''}
    ${warning ? `<div style="font-size:7pt;margin-top:0.5mm;">${warning}</div>` : ''}
    ${note ? `<div style="font-size:6pt;margin-top:0.5mm;">${note}</div>` : ''}
  `
}

// Build Prepack label HTML
export function buildPrepackLabelHTML(description, batchNo, expiry) {
  return `
    <div style="font-size:8pt;font-weight:bold;text-align:center;padding:1mm;">${description}</div>
    <div style="font-size:7pt;margin-top:1mm;">Batch No: <strong>${batchNo}</strong></div>
    <div style="font-size:7pt;margin-top:0.5mm;">Use Before: <strong>${expiry}</strong></div>
  `
}
