// Label printing via hidden iframe → window.print()
// Thermal label: ~25mm wide × 70mm tall (small label)

export function printLabel(labelHTML, copies = 1) {
  for (let i = 0; i < copies; i++) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:25mm;height:70mm;border:none;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: 25mm 70mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 25mm;
    height: 70mm;
    font-family: Arial, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1mm;
  }
  .label-drug {
    font-size: 8pt;
    font-weight: bold;
    text-align: center;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    word-break: break-word;
    line-height: 1.2;
  }
  .label-drug.small-font { font-size: 7pt; }
  .label-drug.black-bg {
    background: black;
    color: white;
    border-radius: 1mm;
  }
  .label-exp {
    font-size: 7pt;
    padding-top: 1mm;
  }
  .label-batch {
    font-size: 7pt;
    padding-top: 0.5mm;
  }
  @media print {
    html, body { width: 25mm; height: 70mm; }
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

// Build small label HTML (IP or OP)
export function buildSmallLabelHTML(drugName, ipop, lot, exp, itemCode) {
  const isAUGM06 = itemCode && itemCode.toUpperCase() === 'AUGM06'
  const isPHEN18 = itemCode && itemCode.toUpperCase() === 'PHEN18'
  const blackBg = isAUGM06
  const smallFont = isPHEN18

  const drugClass = [
    'label-drug',
    blackBg ? 'black-bg' : '',
    smallFont ? 'small-font' : '',
  ].filter(Boolean).join(' ')

  if (ipop === 'OP') {
    const batLine = lot && lot !== 'na----'
      ? `Bat. No.: ${lot}`
      : 'Bat. No.: ______________'
    return `
      <div class="${drugClass}">${drugName}</div>
      <div class="label-batch">${batLine}</div>
    `
  } else {
    // IP label
    const expLine = exp && exp !== 'na----'
      ? `Use before: ${exp}`
      : 'Use before: ____________'
    const batLine = lot && lot !== 'na----'
      ? `Bat. No.: ${lot}`
      : 'Bat. No.: ______________'
    return `
      <div class="${drugClass}">${drugName}</div>
      <div class="label-exp">${expLine}</div>
      <div class="label-batch">${batLine}</div>
    `
  }
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
