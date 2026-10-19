import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { deflateSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { decodeLabelData } from './internalGtinLabel'
import {
  DOT_MM,
  DOTS_PER_MODULE,
  MODULE_MM,
  QUIET_ZONE_MODULES,
  SYMBOL_EDGE_MARGIN_MM,
  buildLabelDataMatrix,
  dataMatrixOptions,
  dataMatrixSvg,
  encodeDataMatrix,
  placeSymbol,
  symbolBoxMm,
} from './labelDataMatrix'

const SETTINGS = { labelWidth: 34.4, labelHeight: 25 }

function symbolFor(overrides = {}) {
  const result = buildLabelDataMatrix({
    itemCode: 'PARA01',
    record: null,
    expiryText: '31 DEC 2027',
    lot: '2512172-1',
    settings: SETTINGS,
    ...overrides,
  })
  if (!result.ok) throw new Error(result.message)
  return result
}

// ── Minimal PNG writer (8-bit greyscale) so the test decodes the very module
//    rows that go to the GDI path and into the SVG. ───────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
/** Matrix rows → PNG with the quiet zone, `scale` pixels per module (3 = printer dots). */
function matrixToPng(matrix, scale) {
  const q = QUIET_ZONE_MODULES
  const width = (matrix.columns + 2 * q) * scale
  const height = (matrix.rows + 2 * q) * scale
  const raw = Buffer.alloc((width + 1) * height, 255)
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0 // filter: none
    const my = Math.floor(y / scale) - q
    for (let x = 0; x < width; x++) {
      const mx = Math.floor(x / scale) - q
      const dark = my >= 0 && my < matrix.rows && mx >= 0 && mx < matrix.columns && matrix.modules[my][mx] === '1'
      raw[y * (width + 1) + 1 + x] = dark ? 0 : 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Parses dataMatrixSvg() back into module rows (dark runs → '1'). */
function svgToModules(svg) {
  const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  const grid = Array.from({ length: Number(h) }, () => Array(Number(w)).fill('0'))
  const d = /<path d="([^"]*)"/.exec(svg)[1]
  for (const [, x, y, len] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(len); i++) grid[Number(y)][Number(x) + i] = '1'
  }
  const q = QUIET_ZONE_MODULES
  return grid.slice(q, grid.length - q).map(row => row.slice(q, row.length - q).join(''))
}

describe('module size and quiet zone (GX420t, 203 dpi)', () => {
  it('one module is exactly 3 printer dots ≈ 0.375 mm, with a 1-module quiet zone', () => {
    expect(DOTS_PER_MODULE).toBe(3)
    expect(DOT_MM).toBeCloseTo(25.4 / 203, 12)
    expect(MODULE_MM).toBeCloseTo(0.3754, 4)
    expect(QUIET_ZONE_MODULES).toBe(1)
  })

  it('a typical prepack symbol is 20 × 20 modules; a 20-character Lot stays at 22 × 22 (≈ 9 mm with quiet zone)', () => {
    expect(symbolFor({ lot: 'A457-26101902' }).matrix).toMatchObject({ columns: 20, rows: 20 })
    for (const lot of ['ABCDEFGHIJ0123456789', 'WWWWWWWWWWWWWWWWWWWW', '(((((((((())))))))))']) {
      const { matrix } = symbolFor({ lot })
      expect(matrix.columns).toBe(22)
      expect(symbolBoxMm(matrix).widthMm).toBeLessThan(9.1)
    }
  })
})

describe('encodeDataMatrix', () => {
  it('returns rows top to bottom with the finder pattern on the left and bottom', () => {
    const { matrix } = symbolFor()
    expect(matrix.modules).toHaveLength(matrix.rows)
    expect(matrix.modules.every(row => row.length === matrix.columns)).toBe(true)
    expect(matrix.modules.every(row => row[0] === '1')).toBe(true)                // solid left edge
    expect(matrix.modules[matrix.rows - 1]).toBe('1'.repeat(matrix.columns))      // solid bottom edge
    expect(matrix.modules[0]).toBe('10'.repeat(matrix.columns / 2))               // timing, top edge
  })

  it('feeds bwip-js the bracketed form, with parentheses in the Lot as ordinals', () => {
    expect(dataMatrixOptions({ internalGtin: '00425873440010', expiryYymmdd: '271231', lot: '(B)A52921725A4' })).toEqual({
      bcid: 'gs1datamatrix',
      text: '(01)00425873440010(17)271231(10)^040B^041A52921725A4',
      parse: true,
    })
  })
})

describe('dataMatrixSvg (HTML print path and previews)', () => {
  it('draws exactly the matrix that goes to the GDI path, sized in mm with the quiet zone', () => {
    const { matrix } = symbolFor({ lot: 'MIPL/A4/UII/91' })
    const svg = dataMatrixSvg(matrix)
    expect(svgToModules(svg)).toEqual(matrix.modules)
    const size = (matrix.columns + 2) * MODULE_MM
    expect(svg).toContain(`width="${Number(size.toFixed(6))}mm"`)
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(svg).toMatch(/<rect width="\d+" height="\d+" fill="#fff"\/>/)
  })
})

describe('placeSymbol', () => {
  const onDotGrid = mm => Math.abs(mm / DOT_MM - Math.round(mm / DOT_MM)) < 1e-3

  it('puts the symbol bottom-right, on whole printer dots, inside the label', () => {
    const { matrix } = symbolFor()
    const p = placeSymbol(matrix, { widthMm: 34.4, heightMm: 25 })
    expect(onDotGrid(p.xMm)).toBe(true)
    expect(onDotGrid(p.yMm)).toBe(true)
    expect(p.xMm + p.widthMm).toBeLessThanOrEqual(34.4 - SYMBOL_EDGE_MARGIN_MM + 1e-9)
    expect(p.yMm + p.heightMm).toBeLessThanOrEqual(25 - SYMBOL_EDGE_MARGIN_MM + 1e-9)
    expect(p.xMm + p.widthMm).toBeGreaterThan(34.4 - SYMBOL_EDGE_MARGIN_MM - DOT_MM)
  })

  it('centres it in the lower half for the 50/50 reconstitution label', () => {
    const { matrix } = symbolFor({ lot: 'ABCDEFGHIJ0123456789' })
    const p = placeSymbol(matrix, { widthMm: 34.4, heightMm: 25, region: 'lower-half' })
    expect(onDotGrid(p.yMm)).toBe(true)
    expect(p.yMm).toBeGreaterThanOrEqual(12.5)
    expect(p.yMm + p.heightMm).toBeLessThanOrEqual(25)
  })
})

describe('buildLabelDataMatrix', () => {
  it('encodes item code, Pack Volume from the record, the printed Use Before and the printed batch number', () => {
    const s = buildLabelDataMatrix({
      itemCode: 'PARA18', record: { itemCode: 'PARA18', prefix: 'PAR', packSize: '60ML' },
      expiryText: '5 SEPT 2027', lot: 'PAR-26101901', settings: SETTINGS,
    })
    expect(s).toMatchObject({
      ok: true, internalGtin: '20425873440489', packVolumeDigit: 2, expiryYymmdd: '270905', lot: 'PAR-26101901',
      hri: '(01)20425873440489(17)270905(10)PAR-26101901',
    })
  })

  it('is on by default and off only when the setting is false', () => {
    expect(symbolFor().ok).toBe(true)
    expect(buildLabelDataMatrix({ itemCode: 'PARA01', expiryText: '31 DEC 2027', lot: 'A1', settings: {} }).ok).toBe(true)
    expect(buildLabelDataMatrix({ itemCode: 'PARA01', expiryText: '31 DEC 2027', lot: 'A1', settings: { labelDataMatrix: false } }))
      .toMatchObject({ ok: false, reason: 'disabled' })
  })

  it('leaves the symbol off, with a reason, rather than encode something the label does not say', () => {
    const base = { itemCode: 'PARA01', expiryText: '31 DEC 2027', lot: 'A457-26101902', settings: SETTINGS }
    expect(buildLabelDataMatrix({ ...base, itemCode: 'PARA1' })).toMatchObject({ ok: false, reason: 'itemCode' })
    expect(buildLabelDataMatrix({ ...base, expiryText: '31/12/27' })).toMatchObject({ ok: false, reason: 'expiry' })
    expect(buildLabelDataMatrix({ ...base, expiryText: '' })).toMatchObject({ ok: false, reason: 'expiry' })
    expect(buildLabelDataMatrix({ ...base, lot: 'pp-26101901' })).toMatchObject({ ok: false, reason: 'lot' })
    expect(buildLabelDataMatrix({ ...base, lot: '' })).toMatchObject({ ok: false, reason: 'lot' })
  })
})

describe('render round-trip: the printed symbol decodes to the element string', () => {
  beforeAll(async () => {
    // Load the reader from node_modules rather than the CDN zxing-wasm uses by default: tests run offline.
    const wasmPath = createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm')
    const wasm = readFileSync(wasmPath)
    await prepareZXingModule({
      overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) },
      fireImmediately: true,
    })
  })

  /** Element string as a scanner transmits it: drop the symbology identifier and any leading/trailing GS. */
  const normalise = text => text.replace(/^\]d2/, '').replace(/^\u001d/, '').replace(/\u001d$/, '')

  it.each([
    ['an ABX batch number', { lot: 'A457-26101902' }],
    ['a plain batch number', { lot: '26101901' }],
    ['Lot 2512172-1', { lot: '2512172-1' }],
    ['Lot 21113HK1', { lot: '21113HK1' }],
    ['Lot (B)A52921725A4', { lot: '(B)A52921725A4' }],
    ['Lot MIPL/A4/UII/91', { lot: 'MIPL/A4/UII/91' }],
    ['Lot 373/8027', { lot: '373/8027' }],
    ['a 20-character Lot', { lot: 'ABCDEFGHIJ0123456789' }],
    ['a Lot that looks like AIs', { lot: '1017(01)' }],
    ['a Pack Volume and an Item Code with a space', { itemCode: 'AIR 01', record: { packSize: '480ML' }, lot: '21113HK1' }],
  ])('%s', async (_name, overrides) => {
    const symbol = symbolFor(overrides)
    // 3 pixels per module — the printer's own dot grid.
    const png = matrixToPng(symbol.matrix, DOTS_PER_MODULE)
    const results = await readBarcodes(new Uint8Array(png), { formats: ['DataMatrix'], textMode: 'Plain' })

    expect(results).toHaveLength(1)
    const [result] = results
    expect(result.symbologyIdentifier).toBe(']d2') // GS1 DataMatrix: FNC1 in first position
    expect(normalise(result.text)).toBe(symbol.elementString)
    expect(decodeLabelData(normalise(result.text))).toMatchObject({
      ok: true,
      data: { internalGtin: symbol.internalGtin, itemCode: symbol.itemCode, expiryYymmdd: symbol.expiryYymmdd, lot: symbol.lot },
    })
  })
})
