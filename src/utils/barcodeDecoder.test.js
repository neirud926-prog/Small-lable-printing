import { describe, it, expect } from 'vitest'
import {
  classifyScannedInput,
  decodeBarcode,
  parseInternalGtinScan,
  resolveScannedGtin,
} from './barcodeDecoder'
import { encodeInternalGtin } from './internalGtin'

// A small item list and GTIN map, shaped like the live data.
const ITEM_LIST = new Set(['PARA01', 'PARA18', 'AIR 01', 'AUGM02', 'AMOX06'])
const GTIN_MAP = {
  '04895126604715': 'AMOX06',   // manufacturer GTIN (HK pharma DataMatrix)
  '04006381333931': 'AUGM02',   // manufacturer EAN-13, stored as GTIN-14
  '00402816304400': 'AUGM02',   // the one BCS gtins row that passes the 04 digit checks
}
const deps = {
  findByGtin: gtin => GTIN_MAP[gtin] || null,
  isItemCode: code => ITEM_LIST.has(code),
}

const GS = '\u001d'

/** What a scan resolves to, the way every scan-aware screen does it. */
function scan(raw, method = 'gs1') {
  const c = classifyScannedInput(raw, method)
  if (c.kind !== 'gtin') return { kind: c.kind, itemCode: c.itemCode }
  return resolveScannedGtin(c, deps)
}

describe('Internal GTIN fast path (issue #31 acceptance)', () => {
  it.each(['gs1', 'legacy'])('00425873440010 → PARA01 and 20425873440489 → PARA18 (decoder: %s)', method => {
    expect(scan('00425873440010', method)).toMatchObject({ itemCode: 'PARA01', source: 'internal-gtin' })
    expect(scan('20425873440489', method)).toMatchObject({ itemCode: 'PARA18', source: 'internal-gtin' })
  })

  it('works on a full DataMatrix scan, with or without the ]d2 symbology identifier', () => {
    expect(scan(']d20100425873440010172712311025121721')).toMatchObject({ itemCode: 'PARA01', source: 'internal-gtin' })
    expect(scan('0120425873440489172712311025121721')).toMatchObject({ itemCode: 'PARA18', source: 'internal-gtin' })
  })

  it('decodes an Item Code with a space', () => {
    expect(scan('00410718656015')).toMatchObject({ itemCode: 'AIR 01', source: 'internal-gtin' })
  })

  it('does not consult the GTIN map for a recognised Internal GTIN', () => {
    const findByGtin = () => 'WRONG1'
    const c = classifyScannedInput('00425873440010')
    expect(resolveScannedGtin(c, { ...deps, findByGtin })).toMatchObject({ itemCode: 'PARA01', source: 'internal-gtin' })
  })

  it('falls back to the GTIN map when the decoded Item Code is not in the item list', () => {
    // 00402816304400 passes the digit checks but decodes to 2U0J10 (not an item).
    expect(scan('00402816304400')).toMatchObject({ itemCode: 'AUGM02', source: 'gtin-map' })
  })

  it('never uses the last six digits for a GTIN with 04 in digits 2–3', () => {
    const notListed = encodeInternalGtin('ZZZZ99', 0).internalGtin
    expect(scan(notListed)).toMatchObject({ itemCode: '', source: null })
    // Wrong check digit / reserved range / digit 1 = 9 — still never last six.
    expect(scan('00425873440011')).toMatchObject({ itemCode: '' })
    expect(scan('00499999999993')).toMatchObject({ itemCode: '' })
    expect(scan('90425873440018')).toMatchObject({ itemCode: '' })
    expect(resolveScannedGtin(['00425873440011', 'na----', 'na----'], { findByGtin: deps.findByGtin }).itemCode).toBe('')
  })
})

describe('strict Lot for Internal GTIN labels: Lot = everything after AI 10', () => {
  const LOTS = ['2512172-1', '21113HK1', '(B)A52921725A4', 'MIPL/A4/UII/91', '373/8027']

  it.each(LOTS)('Lot %s round-trips exactly (DataMatrix scan with ]d2)', lot => {
    const raw = ']d2' + '01' + '00425873440010' + '17' + '271231' + '10' + lot
    expect(scan(raw)).toEqual({ itemCode: 'PARA01', source: 'internal-gtin', gtin: '00425873440010', lot, exp: '271231' })
  })

  it.each(LOTS)('Lot %s round-trips exactly with the legacy decoder too', lot => {
    const raw = '01' + '20425873440489' + '17' + '280131' + '10' + lot
    expect(scan(raw, 'legacy')).toMatchObject({ itemCode: 'PARA18', source: 'internal-gtin', lot, exp: '280131' })
  })

  it('stops the Lot only at a real FNC1 (GS or ^ substitute)', () => {
    expect(parseInternalGtinScan(`0100425873440010` + `1021113HK1${GS}17271231`)).toEqual({ gtin: '00425873440010', lot: '21113HK1', exp: '271231' })
    expect(parseInternalGtinScan(`0100425873440010` + `1021113HK1^17271231`)).toEqual({ gtin: '00425873440010', lot: '21113HK1', exp: '271231' })
  })

  it('ignores scans whose GTIN is not 04-prefixed', () => {
    expect(parseInternalGtinScan('010489512660471510A520005A11727123190HK-28748')).toBeNull()
    expect(parseInternalGtinScan('04895126604715')).toBeNull()
    expect(parseInternalGtinScan('PARA01')).toBeNull()
  })

  it('shows why: the old boundary guess would have cut these Lots', () => {
    // The manufacturer heuristics read "21" as AI 21 (serial) — fine for HK
    // pharma barcodes, wrong for an Internal GTIN Lot.
    expect(decodeBarcode('01004258734400101727123110' + '21113HK1')[1]).not.toBe('21113HK1')
  })
})

describe('manufacturer GTINs behave exactly as before', () => {
  it('HK pharma DataMatrix without FNC1: heuristic Lot / expiry, GTIN map', () => {
    const raw = '010489512660471510A520005A11727123190HK-28748'
    expect(decodeBarcode(raw)).toEqual(['04895126604715', 'A520005A1', '271231'])
    expect(scan(raw)).toEqual({ itemCode: 'AMOX06', source: 'gtin-map', gtin: '04895126604715', lot: 'A520005A1', exp: '271231' })
  })

  it('HK pharma DataMatrix with expiry and AI 90 after the Lot', () => {
    const raw = '0104895126604715' + '1025R0891728070190HK-45024'
    expect(decodeBarcode(raw)).toEqual(['04895126604715', '25R089', '280701'])
    expect(scan(raw)).toMatchObject({ itemCode: 'AMOX06', source: 'gtin-map', lot: '25R089', exp: '280701' })
  })

  it('EAN-13 → GTIN map', () => {
    expect(scan('4006381333931')).toMatchObject({ itemCode: 'AUGM02', source: 'gtin-map', gtin: '04006381333931' })
  })

  it('unknown manufacturer GTIN → last six digits, as before', () => {
    expect(scan('05012345678900')).toMatchObject({ itemCode: '678900', source: 'last-six' })
    expect(scan('0105012345678900' + '17271231' + '10ABC123')).toMatchObject({ itemCode: '678900', source: 'last-six', lot: 'ABC123', exp: '271231' })
    expect(resolveScannedGtin(['05012345678900', 'na----', 'na----'], { findByGtin: deps.findByGtin }).itemCode).toBe('678900')
  })

  it('item codes and IP barcodes are untouched', () => {
    expect(scan('para01')).toEqual({ kind: 'op-code', itemCode: 'PARA01' })
    expect(scan('IP01AUGM02XYZ')).toEqual({ kind: 'ip-code', itemCode: 'AUGM02' })
  })
})
