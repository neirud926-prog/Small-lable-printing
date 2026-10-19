// Internal GTIN GS1 DataMatrix for Prepack / ABX / Extemp labels (issue #32).
//
// bwip-js encodes the symbol; this file turns its module matrix into
//   - an SVG for the HTML print path (iframe / kiosk browser) and the previews, and
//   - plain rows of 0/1 for the native GDI path, which draws each module itself.
// Both come from the same matrix, so every print path carries the same symbol.
//
// Module size suits the Zebra GX420t: one module is exactly 3 printer dots at
// 203 dpi (≈ 0.375 mm), the same as the Tiny 2D-code Printing App's labels, with
// a 1-module white quiet zone around the symbol.

// The default export: bwip-js's named `raw` export is the encoder for the "raw"
// symbology, not the ToRaw function used here.
import bwipjs from 'bwip-js'
import { encodeInternalGtin, packVolumeDigitForRecord } from './internalGtin'
import { buildLabelElementString, expiryTextToYymmdd } from './internalGtinLabel'

/** The label printer's resolution (Zebra GX420t). */
export const PRINTER_DPI = 203
/** One DataMatrix module is exactly this many printer dots, so every module prints the same size. */
export const DOTS_PER_MODULE = 3
/** One printer dot in mm. */
export const DOT_MM = 25.4 / PRINTER_DPI
/** One DataMatrix module in mm: 3 dots at 203 dpi ≈ 0.3754 mm. */
export const MODULE_MM = DOTS_PER_MODULE * DOT_MM
/** White modules kept clear on every side of the symbol. */
export const QUIET_ZONE_MODULES = 1
/** Gap kept between the label edge and the symbol's quiet zone (label stock can drift). */
export const SYMBOL_EDGE_MARGIN_MM = 0.6
/** Extra space kept between label text and the symbol's quiet zone. */
export const SYMBOL_TEXT_GAP_MM = 0.4

/** Settings switch (Settings → Label Layout → 2D code); on unless explicitly turned off. */
export function isLabelDataMatrixEnabled(settings) {
  return !settings || settings.labelDataMatrix !== false
}

/**
 * bwip-js options for the symbol. The text is the bracketed form
 * `(01)…(17)…(10)…`, except that a parenthesis inside the Lot (allowed, e.g.
 * `(B)A52921725A4`) would read as the start of an AI, so it is written as the
 * ordinal `^040` / `^041`, which bwip-js expands with `parse`.
 */
export function dataMatrixOptions({ internalGtin, expiryYymmdd, lot }) {
  const escapedLot = lot.replace(/\(/g, '^040').replace(/\)/g, '^041')
  return { bcid: 'gs1datamatrix', text: `(01)${internalGtin}(17)${expiryYymmdd}(10)${escapedLot}`, parse: true }
}

/**
 * Encodes the symbol. `modules` are the rows top to bottom, each a string of
 * '1' (dark) / '0' (light), without the quiet zone.
 */
export function encodeDataMatrix(data) {
  const options = dataMatrixOptions(data)
  const [matrix] = bwipjs.raw(options.bcid, options.text, { parse: options.parse })
  if (!matrix || !matrix.pixx || !Array.isArray(matrix.pixs)) throw new Error('bwip-js returned no DataMatrix')
  const { pixx: columns, pixy: rows, pixs } = matrix
  const modules = []
  for (let y = 0; y < rows; y++) modules.push(pixs.slice(y * columns, (y + 1) * columns).map(v => (v ? '1' : '0')).join(''))
  return { columns, rows, modules }
}

/** Width/height of the symbol including its quiet zone, in mm. */
export function symbolBoxMm(matrix) {
  return {
    widthMm: (matrix.columns + 2 * QUIET_ZONE_MODULES) * MODULE_MM,
    heightMm: (matrix.rows + 2 * QUIET_ZONE_MODULES) * MODULE_MM,
  }
}

const snapDown = mm => Math.floor(mm / DOT_MM + 1e-9) * DOT_MM
// mm for markup: 6 decimals keeps positions within 0.00001 dot of the dot grid.
const fmt = mm => Number(mm.toFixed(6))

/**
 * Where the symbol (with its quiet zone) sits on a label: against the right
 * edge, and either at the bottom (`'bottom'`) or centred in the lower half
 * (`'lower-half'`, for the 50/50 reconstitution label). Coordinates are from
 * the label's top-left and land on whole printer dots, so modules print exactly
 * 3 dots each.
 */
export function placeSymbol(matrix, { widthMm, heightMm, region = 'bottom' }) {
  const box = symbolBoxMm(matrix)
  const xMm = snapDown(widthMm - SYMBOL_EDGE_MARGIN_MM - box.widthMm)
  const yMm = region === 'lower-half'
    ? snapDown(heightMm / 2 + (heightMm / 2 - box.heightMm) / 2)
    : snapDown(heightMm - SYMBOL_EDGE_MARGIN_MM - box.heightMm)
  return { xMm: fmt(xMm), yMm: fmt(yMm), widthMm: fmt(box.widthMm), heightMm: fmt(box.heightMm) }
}

/**
 * The symbol as a self-contained SVG, `widthMm` × `heightMm` including the
 * white quiet zone. One unit of the viewBox is one module; each run of dark
 * modules in a row is one rectangle in a single path.
 */
export function dataMatrixSvg(matrix) {
  const q = QUIET_ZONE_MODULES
  const w = matrix.columns + 2 * q
  const h = matrix.rows + 2 * q
  let d = ''
  matrix.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '1') continue
      let end = x
      while (end + 1 < row.length && row[end + 1] === '1') end++
      d += `M${x + q} ${y + q}h${end - x + 1}v1h${-(end - x + 1)}z`
      x = end
    }
  })
  const box = symbolBoxMm(matrix)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(box.widthMm)}mm" height="${fmt(box.heightMm)}mm" ` +
    `viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" style="display:block">` +
    `<rect width="${w}" height="${h}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  )
}

/**
 * Absolutely positioned symbol for a label page (position is from the page's
 * top-left, so body padding never moves it off the dot grid).
 */
export function dataMatrixHTML(symbol) {
  const { placement } = symbol
  return (
    `<div class="label-datamatrix" style="position:absolute;left:${placement.xMm}mm;top:${placement.yMm}mm;` +
    `width:${placement.widthMm}mm;height:${placement.heightMm}mm;line-height:0;">${dataMatrixSvg(symbol.matrix)}</div>`
  )
}

export const TEXT_TOO_BIG_MESSAGE = 'The label text does not fit beside the 2D code at the current font sizes ' +
  '(Settings → Label Layout), so the 2D code will be left off.'

/**
 * What to do with the symbol when a label is printed.
 *   symbol  buildLabelDataMatrix() result, or null (no item / date / batch yet)
 *   fits    the preview's check that the label text fits beside the symbol:
 *           true / false, or null while the current preview is unmeasured
 * Returns { action, message }:
 *   'print' — print with the symbol
 *   'none'  — print without it, nothing to ask (no symbol, or turned off)
 *   'wait'  — do not print yet: the preview has not been measured
 *   'ask'   — the code should be on the label but cannot be; ask staff
 *             (message says why) and print without it if they agree
 */
export function symbolPrintDecision(symbol, fits) {
  if (!symbol || symbol.reason === 'disabled') return { action: 'none', message: '' }
  if (!symbol.ok) return { action: 'ask', message: symbol.message }
  if (fits === null || fits === undefined) {
    return { action: 'wait', message: 'The label preview is still updating — press Confirm & Print again.' }
  }
  return fits ? { action: 'print', message: '' } : { action: 'ask', message: TEXT_TOO_BIG_MESSAGE }
}

/**
 * Everything a Prepack / ABX / Extemp label needs to carry the Internal GTIN
 * DataMatrix `(01)(17)(10)`.
 *
 *   itemCode    the label's item code (Prepack: the drug code)
 *   record      its ABX / Prepack / Extemp row — the Pack Volume digit comes
 *               from a field that clearly states 30/60/120/240/480 mL, else 0
 *   expiryText  the Use Before text exactly as printed on the label
 *   lot         the batch number exactly as printed on the label
 *   region      'bottom' (Prepack / Extemp) or 'lower-half' (reconstitution)
 *
 * Returns { ok: true, …element string fields, matrix, placement } or
 * { ok: false, reason, message } — reason 'disabled' when the setting is off.
 * The symbol always encodes the text printed beside it, or is left off.
 */
export function buildLabelDataMatrix({ itemCode, record, expiryText, lot, settings, region = 'bottom' }) {
  if (!isLabelDataMatrixEnabled(settings)) {
    return { ok: false, reason: 'disabled', message: 'The 2D code is turned off in Settings.' }
  }
  const code = String(itemCode ?? '').trim()
  if (!encodeInternalGtin(code, 0).ok) {
    return { ok: false, reason: 'itemCode', message: `Item code "${code}" cannot be made into an Internal GTIN (it must be 6 letters/digits).` }
  }
  const expiryYymmdd = expiryTextToYymmdd(expiryText)
  if (!expiryYymmdd) {
    return { ok: false, reason: 'expiry', message: `The Use Before date "${String(expiryText ?? '').trim()}" is not a date the 2D code can carry (use DD/MM/YYYY).` }
  }
  const element = buildLabelElementString({
    itemCode: code,
    packVolumeDigit: packVolumeDigitForRecord(record),
    expiryYymmdd,
    lot: String(lot ?? '').trim(),
  })
  if (!element.ok) return { ok: false, reason: element.field, message: element.message }

  const matrix = encodeDataMatrix(element)
  const widthMm = (settings && settings.labelWidth) || 34.4
  const heightMm = (settings && settings.labelHeight) || 25
  const placement = placeSymbol(matrix, { widthMm, heightMm, region })
  // The symbol must sit wholly on the label — and, on the 50/50
  // reconstitution label, wholly in the white lower half.
  const top = region === 'lower-half' ? heightMm / 2 : 0
  if (placement.xMm < 0 || placement.yMm < top - 1e-6 || placement.yMm + placement.heightMm > heightMm + 1e-6) {
    return { ok: false, reason: 'labelSize', message: `The ${widthMm} × ${heightMm} mm label is too small for the 2D code.` }
  }
  return { ...element, matrix, placement }
}
