import { describe, it, expect } from 'vitest'
import {
  buildLabelElementString,
  decodeLabelData,
  expiryTextToYymmdd,
  isPrintableLot,
  normaliseLot,
  parseGs1Expiry,
} from './internalGtinLabel'

describe('expiryTextToYymmdd — the Use Before text as printed → AI (17)', () => {
  it.each([
    ['19 OCT 2027', '271019'],   // formatDateLabel (Reconstitution tabs)
    ['5 JAN 2027', '270105'],
    ['30 SEPT 2027', '270930'],  // en-GB short month in Chromium / WebView2
    ['30 SEP 2027', '270930'],
    ['29 FEB 2028', '280229'],
    ['19-Oct-2027', '271019'],   // Small Label style
    ['19/10/2027', '271019'],    // Prepack override (DD/MM/YYYY)
    ['1/2/2027', '270201'],
    ['19-10-2027', '271019'],
    ['19.10.2027', '271019'],
    ['19102027', '271019'],
    ['  19 oct 2027  ', '271019'],
  ])('%j → %s', (text, yymmdd) => {
    expect(expiryTextToYymmdd(text)).toBe(yymmdd)
  })

  it.each([
    '', null, undefined, 'dd-mmm-yyyy', '31 SEPT 2027', '29 FEB 2027', '32/01/2027', '01/13/2027',
    '19 OCTO 2027', '19 XYZ 2027', '19/10/27', '19 OCT 1999', '19 OCT 2100', '2027-10-19', '19/10-2027',
  ])('refuses %j', text => {
    expect(expiryTextToYymmdd(text)).toBeNull()
  })
})

describe('parseGs1Expiry', () => {
  it('reads YYMMDD as 20YY and refuses day 00 and impossible dates', () => {
    expect(parseGs1Expiry('271231')).toEqual({ year: 2027, month: 12, day: 31 })
    expect(parseGs1Expiry('271200')).toBeNull()
    expect(parseGs1Expiry('270230')).toBeNull()
    expect(parseGs1Expiry('2712')).toBeNull()
  })
})

describe('Lot rules', () => {
  it('accepts A–Z 0–9 - / ( ) up to 20 characters', () => {
    for (const lot of ['2512172-1', '21113HK1', '(B)A52921725A4', 'MIPL/A4/UII/91', '373/8027', 'A457-26101902', 'ABCDEFGHIJ0123456789']) {
      expect(isPrintableLot(lot)).toBe(true)
    }
  })

  it('refuses spaces, other characters, 21+ characters and lower case as printed', () => {
    expect(normaliseLot('A1 2')).toMatchObject({ ok: false })
    expect(normaliseLot('A1_2')).toMatchObject({ ok: false })
    expect(normaliseLot('ABCDEFGHIJ01234567890')).toMatchObject({ ok: false })
    expect(normaliseLot('')).toMatchObject({ ok: false })
    expect(normaliseLot(' a457-1 ')).toEqual({ ok: true, lot: 'A457-1' })
    expect(isPrintableLot('a457-1')).toBe(false)
  })
})

describe('buildLabelElementString — (01)(17)(10), self-checked', () => {
  it('builds the element string and bracketed form', () => {
    expect(buildLabelElementString({ itemCode: 'PARA18', packVolumeDigit: 2, expiryYymmdd: '271231', lot: '2512172-1' })).toEqual({
      ok: true,
      internalGtin: '20425873440489',
      itemCode: 'PARA18',
      packVolumeDigit: 2,
      expiryYymmdd: '271231',
      lot: '2512172-1',
      elementString: '012042587344048917271231102512172-1',
      hri: '(01)20425873440489(17)271231(10)2512172-1',
    })
  })

  it.each(['2512172-1', '21113HK1', '(B)A52921725A4', 'MIPL/A4/UII/91', '373/8027'])('Lot %s decodes back exactly', lot => {
    const built = buildLabelElementString({ itemCode: 'PARA01', packVolumeDigit: 0, expiryYymmdd: '271231', lot })
    expect(built.ok).toBe(true)
    expect(decodeLabelData(built.elementString)).toEqual({
      ok: true,
      data: { internalGtin: '00425873440010', itemCode: 'PARA01', packVolumeDigit: 0, packVolumeMl: null, expiryYymmdd: '271231', lot },
    })
  })

  it('refuses what it cannot carry exactly', () => {
    const base = { itemCode: 'PARA01', packVolumeDigit: 0, expiryYymmdd: '271231', lot: 'A457-26101902' }
    expect(buildLabelElementString({ ...base, itemCode: 'PARA1' })).toMatchObject({ ok: false, field: 'itemCode' })
    expect(buildLabelElementString({ ...base, itemCode: 'PAR/01' })).toMatchObject({ ok: false, field: 'itemCode' })
    expect(buildLabelElementString({ ...base, packVolumeDigit: 7 })).toMatchObject({ ok: false, field: 'packVolume' })
    expect(buildLabelElementString({ ...base, expiryYymmdd: '271200' })).toMatchObject({ ok: false, field: 'expiry' })
    expect(buildLabelElementString({ ...base, lot: 'a457-26101902' })).toMatchObject({ ok: false, field: 'lot' })
    expect(buildLabelElementString({ ...base, lot: 'A457 26101902' })).toMatchObject({ ok: false, field: 'lot' })
  })
})

describe('decodeLabelData', () => {
  it('refuses anything but 01 + 14, 17 + 6, 10 + Lot with a v1 Internal GTIN', () => {
    expect(decodeLabelData('0100425873440010').ok).toBe(false)
    expect(decodeLabelData('01004258734400101027123117271231').ok).toBe(false)
    expect(decodeLabelData('010489512660471517271231102512172-1').ok).toBe(false)
    expect(decodeLabelData('010042587344001017271200102512172-1').ok).toBe(false)
  })
})
