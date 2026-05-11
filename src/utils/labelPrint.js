// Label printing via hidden iframe or Tauri silent-print command.
// Label size: 34.4mm × 25mm (landscape) — configurable via settings.
//
// Prints are queued one-at-a-time so multiple copies never race each other.

import { invoke } from '@tauri-apps/api/core'

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ── CSS builder ───────────────────────────────────────────────────────────────
export function buildPageCSS(settings = {}) {
  const w   = settings.labelWidth    || 34.4
  const h   = settings.labelHeight   || 25
  const pt  = settings.labelPadTop   ?? 0
  const pb  = settings.labelPadBottom?? 0
  const pl  = settings.labelPadLeft  ?? 0
  const pr  = settings.labelPadRight ?? 0
  const ff  = settings.fontFamily    || 'Arial'
  const dfs = settings.drugFontSize  || 8.5
  const dfb = settings.drugFontBold  !== false
  const efs = settings.expFontSize   ?? 4.5
  const efb = settings.expFontBold   !== false
  const bfs = settings.batchFontSize || 6
  const bfb = !!settings.batchFontBold
  const sfs = settings.signFontSize  || 5.5
  const sfb = settings.signFontBold  !== false
  const batLine = settings.batchUnderline ? 'border-bottom: 0.25mm solid #000;' : ''

  return `
  @page { size: ${w}mm ${h}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${w}mm; height: ${h}mm;
    font-family: ${ff}, sans-serif;
    overflow: hidden;
    display: flex; flex-direction: column;
    padding: ${pt}mm ${pr}mm ${pb}mm ${pl}mm;
  }
  .label-drug {
    flex: 1; display: flex; align-items: center; justify-content: center;
    text-align: center; font-size: ${dfs}pt; font-weight: ${dfb ? 'bold' : 'normal'};
    word-break: break-word; line-height: 1.25;
  }
  .label-drug.small-font { font-size: ${Math.max(dfs - 1.5, 5)}pt; }
  .label-drug.black-bg   { background: black; color: white; border-radius: 0.8mm; padding: 0 1mm; }
  .label-exp {
    font-size: ${efs}pt;
    text-align: left;
    padding-bottom: 0.5mm;
    font-weight: ${efb ? 'bold' : 'normal'};
  }
  .label-bat {
    display: flex; align-items: flex-end;
    font-size: ${bfs}pt; font-weight: bold; margin-top: 1.2mm;
  }
  .label-bat-line {
    flex: 1; ${batLine} margin-left: 0.8mm;
    font-weight: ${bfb ? 'bold' : 'normal'}; font-size: ${bfs}pt; padding-left: 0.5mm;
  }
  .label-footer {
    display: flex; gap: 2mm; margin-top: 1mm;
    font-size: ${sfs}pt; font-weight: ${sfb ? 'bold' : 'normal'};
  }
  .label-footer-item { display: flex; align-items: baseline; flex: 1; }
  .label-footer-line  { flex: 1; border-bottom: 0.25mm solid #000; margin-left: 0.5mm; height: 3mm; }
  @media print { html, body { width: ${w}mm; height: ${h}mm; } }
  `
}

export function buildFullPageHTML(labelHTML, settings) {
  const css = buildPageCSS(settings)
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${css}</style></head>
<body>${labelHTML}</body>
</html>`
}

// ── Serialised print queue ────────────────────────────────────────────────────
// Each call to _enqueue returns a promise chained to the previous one,
// so prints execute strictly one-at-a-time regardless of how fast they're queued.
let _printQueue = Promise.resolve()

function _enqueueIframe(labelHTML, settings) {
  const w = settings.labelWidth  || 34.4
  const h = settings.labelHeight || 25

  _printQueue = _printQueue.then(() => new Promise(resolve => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText =
      `position:fixed;left:-9999px;top:-9999px;width:${w}mm;height:${h}mm;border:none;`

    // Use srcdoc so we get one clean load event with our content
    iframe.srcdoc = buildFullPageHTML(labelHTML, settings)

    iframe.onload = () => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      // Give the OS print spooler a moment, then clean up
      setTimeout(() => {
        try { document.body.removeChild(iframe) } catch (_) {}
        resolve()
      }, 800)
    }

    document.body.appendChild(iframe)
  }))
}

function _enqueueSilent(labelHTML, settings) {
  const w = settings.labelWidth  || 34.4
  const h = settings.labelHeight || 25
  const css = buildPageCSS(settings)
  const printerName = settings.printerName || ''

  // ── Native path (no browser required) ──────────────────────────────────────
  // Parse the small-label HTML to extract the raw fields, then invoke the
  // PowerShell / System.Drawing command.  Falls back to the browser path if
  // the HTML doesn't look like a small label or native printing fails.
  const fields = _parseSmallLabelFields(labelHTML, settings)

  _printQueue = _printQueue.then(async () => {
    if (fields) {
      try {
        await invoke('print_label_powershell', {
          drugName:    fields.drugName,
          expiry:      fields.expiry,
          batchNo:     fields.batchNo,
          ipop:        fields.ipop,
          isBlackBg:   fields.isBlackBg,
          isSmallFont: fields.isSmallFont,
          printerName,
          widthMm:       w,
          heightMm:      h,
          drugFontSize:  settings.drugFontSize  || 8.5,
          batchFontSize: settings.batchFontSize || 6,
          signFontSize:  settings.signFontSize  || 5.5,
          fontFamily:    settings.fontFamily    || 'Arial',
          drugFontBold:  settings.drugFontBold  !== false,
          padLeft:       settings.labelPadLeft   ?? 0,
          padRight:      settings.labelPadRight  ?? 0,
          padTop:        settings.labelPadTop    ?? 0,
          padBottom:     settings.labelPadBottom ?? 0,
          expiryLabel:   settings.expiryLabel || 'Use before:',
          batchUnderline: !!settings.batchUnderline,
          expFontSize:    settings.expFontSize  ?? 4.5,
          expFontBold:    settings.expFontBold  !== false,
          batchFontBold:  !!settings.batchFontBold,
          signFontBold:   settings.signFontBold !== false,
        })
        return   // success — skip browser fallback
      } catch (e) {
        const msg = typeof e === 'string' ? e : (e?.message || String(e))
        console.warn('[labelPrint] Native print failed, trying browser fallback:', msg)
        // Surface native error but still attempt browser below
      }
    }

    // ── Browser fallback (Edge / Chrome / Brave with --kiosk-printing) ────────
    invoke('print_label_html', { html: labelHTML, css, widthMm: w, heightMm: h, printerName })
      .catch(e => {
        const msg = typeof e === 'string' ? e : (e?.message || 'Print failed. Check printer connection.')
        console.error('[labelPrint] Browser print error:', msg)
        window.dispatchEvent(new CustomEvent('sml:print-error', { detail: msg }))
      })
  })
}

/// Extract label fields from the HTML generated by buildSmallLabelHTML().
/// Returns null for non-small-label HTML (ABX / Extemp / Prepack).
function _parseSmallLabelFields(html, settings = {}) {
  const div = document.createElement('div')
  div.innerHTML = html

  const drugEl = div.querySelector('.label-drug')
  if (!drugEl) return null   // not a small label

  const expEl  = div.querySelector('.label-exp')
  const batEl  = div.querySelector('.label-bat-line')

  const prefix  = settings.expiryLabel || 'Use before:'
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expiry  = expEl  ? expEl.textContent.replace(new RegExp(`^${escaped}\\s*`, 'i'), '').trim() : ''
  const batchNo = batEl  ? batEl.textContent.trim() : ''

  // Infer ipop: expiry row is only rendered for IP labels
  const ipop = expEl ? 'IP' : 'OP'

  return {
    drugName:    drugEl.textContent.trim(),
    expiry,
    batchNo,
    ipop,
    isBlackBg:   drugEl.classList.contains('black-bg'),
    isSmallFont: drugEl.classList.contains('small-font'),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function printLabel(labelHTML, copies = 1, settings = {}) {
  for (let i = 0; i < copies; i++) {
    if (isTauri() && settings.silentPrint) {
      _enqueueSilent(labelHTML, settings)
    } else {
      _enqueueIframe(labelHTML, settings)
    }
  }
}

// ── Drug Reconstitution label (50/50 split: batch on top, expiry on bottom) ──
export function buildReconstitutionPageCSS(settings = {}) {
  const w  = settings.labelWidth  || 34.4
  const h  = settings.labelHeight || 25
  const ff = settings.fontFamily  || 'Arial'
  return `
  @page { size: ${w}mm ${h}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}mm; height: ${h}mm; overflow: hidden; }
  body { font-family: ${ff}, sans-serif; }
  @media print { html, body { width: ${w}mm; height: ${h}mm; } }
  `
}

export function buildReconstitutionFullPageHTML(labelHTML, settings) {
  const css = buildReconstitutionPageCSS(settings)
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${css}</style></head>
<body>${labelHTML}</body>
</html>`
}

function _enqueueReconstitutionIframe(labelHTML, settings) {
  const w = settings.labelWidth  || 34.4
  const h = settings.labelHeight || 25

  _printQueue = _printQueue.then(() => new Promise(resolve => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText =
      `position:fixed;left:-9999px;top:-9999px;width:${w}mm;height:${h}mm;border:none;`
    iframe.srcdoc = buildReconstitutionFullPageHTML(labelHTML, settings)
    iframe.onload = () => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => {
        try { document.body.removeChild(iframe) } catch (_) {}
        resolve()
      }, 800)
    }
    document.body.appendChild(iframe)
  }))
}

function _enqueueReconstitutionSilent(batchNo, expiry, labelHTML, settings, itemCode = '') {
  const w = settings.labelWidth  || 34.4
  const h = settings.labelHeight || 25
  const css = buildReconstitutionPageCSS(settings)
  const printerName = settings.printerName || ''

  _printQueue = _printQueue.then(async () => {
    try {
      await invoke('print_reconstitution_label_powershell', {
        batchNo,
        expiry,
        printerName,
        widthMm:        w,
        heightMm:       h,
        titleFontSize:  settings.reconTitleFontSize || settings.batchFontSize || 6,
        titleFontBold:  settings.reconTitleFontBold ?? false,
        valueFontSize:  settings.reconValueFontSize || ((settings.drugFontSize || 8.5) + 0.5),
        valueFontBold:  settings.reconValueFontBold ?? true,
        fontFamily:     settings.fontFamily    || 'Arial',
        topBlackBg:     isBlackBgItem(itemCode),
      })
      return
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || String(e))
      console.warn('[labelPrint] Native recon print failed, trying browser fallback:', msg)
    }

    invoke('print_label_html', { html: labelHTML, css, widthMm: w, heightMm: h, printerName })
      .catch(e => {
        const msg = typeof e === 'string' ? e : (e?.message || 'Print failed. Check printer connection.')
        console.error('[labelPrint] Browser recon print error:', msg)
        window.dispatchEvent(new CustomEvent('sml:print-error', { detail: msg }))
      })
  })
}

export function printReconstitutionLabel(batchNo, expiry, copies = 1, settings = {}, itemCode = '') {
  const labelHTML = buildReconstitutionLabelHTML(batchNo, expiry, settings, itemCode)
  for (let i = 0; i < copies; i++) {
    if (isTauri() && settings.silentPrint) {
      _enqueueReconstitutionSilent(batchNo, expiry, labelHTML, settings, itemCode)
    } else {
      _enqueueReconstitutionIframe(labelHTML, settings)
    }
  }
}

export function buildReconstitutionLabelHTML(batchNo, expiry, settings = {}, itemCode = '') {
  const ff        = settings.fontFamily    || 'Arial'
  const titlePt   = settings.reconTitleFontSize || settings.batchFontSize || 6
  const valuePt   = settings.reconValueFontSize || ((settings.drugFontSize || 8.5) + 0.5)
  const titleW    = (settings.reconTitleFontBold ?? false) ? 'bold' : 'normal'
  const valueW    = (settings.reconValueFontBold ?? true)  ? 'bold' : 'normal'
  const isBlackBg = isBlackBgItem(itemCode)
  const half = `flex:1 1 50%;display:flex;flex-direction:column;justify-content:center;padding:0 1mm;overflow:hidden;`
  const topHalf = isBlackBg
    ? `${half}background:#000;color:#fff;`
    : half
  const title = `font-size:${titlePt}pt;font-family:${ff},sans-serif;line-height:1.1;font-weight:${titleW};`
  const value = `font-size:${valuePt}pt;font-family:${ff},sans-serif;font-weight:${valueW};line-height:1.15;margin-top:0.5mm;`
  return `
    <div style="display:flex;flex-direction:column;width:100%;height:100%;">
      <div style="${topHalf}">
        <div style="${title}">Batch No:</div>
        <div style="${value}">${batchNo || ''}</div>
      </div>
      <div style="${half}">
        <div style="${title}">Use Before:</div>
        <div style="${value}">${expiry || ''}</div>
      </div>
    </div>
  `
}

// Item codes that get black-background treatment on the small label.
// Currently AUGM06 (the Augmentin 600mg lookalike that pharmacists must not
// dispense as standard amoxicillin). Reconstitution labels mirror this for
// the upper "Batch No" half so the black flag is visually consistent.
export function isBlackBgItem(itemCode) {
  return !!itemCode && itemCode.trim().toUpperCase() === 'AUGM06'
}

// ── Label HTML builders ───────────────────────────────────────────────────────

// Small label (34.4mm × 25mm landscape)
export function buildSmallLabelHTML(drugName, ipop, lot, exp, itemCode, settings = {}) {
  const isPHEN18 = itemCode && itemCode.toUpperCase() === 'PHEN18'

  const drugClass = [
    'label-drug',
    isBlackBgItem(itemCode) ? 'black-bg' : '',
    isPHEN18 ? 'small-font' : '',
  ].filter(Boolean).join(' ')

  const batValue = lot && lot !== 'na----' ? lot : ''
  const expLabel = settings.expiryLabel || 'Use before:'
  const expRow   = ipop === 'IP' && exp && exp !== 'na----'
    ? `<div class="label-exp">${expLabel} ${exp}</div>`
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

// ABX / OPLabel (3-column, for batch record sheet)
export function buildAbxLabelHTML(drugName, batchNo, expiry, itemCode, settings = {}) {
  const drugStyle = isBlackBgItem(itemCode) ? 'background:black;color:white;' : ''
  const dfs = settings.drugFontSize  || 8
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

// Extemp / EC label
export function buildExtempLabelHTML(description, batchNo, expiry, storage, warning, note, settings = {}) {
  const dfs = settings.drugFontSize  || 8
  const bfs = settings.batchFontSize || 7
  return `
    <div style="font-size:${dfs}pt;font-weight:bold;text-align:center;padding:1mm;">${description}</div>
    <div style="font-size:${bfs}pt;margin-top:1mm;">Batch No.: <strong>${batchNo}</strong></div>
    <div style="font-size:${bfs}pt;margin-top:0.5mm;">Use Before: <strong>${expiry}</strong></div>
    ${storage ? `<div style="font-size:${bfs}pt;margin-top:0.5mm;">${storage}</div>` : ''}
    ${warning ? `<div style="font-size:${bfs}pt;margin-top:0.5mm;">${warning}</div>` : ''}
    ${note    ? `<div style="font-size:${Math.max(bfs - 1, 5)}pt;margin-top:0.5mm;">${note}</div>` : ''}
  `
}

// Prepack label
export function buildPrepackLabelHTML(description, batchNo, expiry, settings = {}) {
  const dfs = settings.drugFontSize  || 8
  const bfs = settings.batchFontSize || 7
  return `
    <div style="font-size:${dfs}pt;font-weight:bold;text-align:center;padding:1mm;">${description}</div>
    <div style="font-size:${bfs}pt;margin-top:1mm;">Batch No: <strong>${batchNo}</strong></div>
    <div style="font-size:${bfs}pt;margin-top:0.5mm;">Use Before: <strong>${expiry}</strong></div>
  `
}
