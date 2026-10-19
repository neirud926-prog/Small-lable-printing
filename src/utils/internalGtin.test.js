import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  FIRST_RESERVED_ITEM_NUMBER,
  ITEM_CODE_CHARACTERS,
  PACK_VOLUMES,
  decodeInternalGtin,
  encodeInternalGtin,
  gs1CheckDigit,
  hasInternalGtinPrefix,
  internalGtinItemCode,
  packVolumeDigitForMl,
  packVolumeDigitForRecord,
  packVolumeDigitFromText,
  packVolumeMlForDigit,
} from './internalGtin'

// Shared test-case file published by the Tiny 2D-code Printing App
// (test-vectors/internal-gtin-v1.csv there). Copied verbatim — re-copy it,
// never edit it, when that repo regenerates it.
const TEST_CASE_FILE = fileURLToPath(new URL('../../test-vectors/internal-gtin-v1.csv', import.meta.url))

function readTestCases() {
  const [header, ...rows] = readFileSync(TEST_CASE_FILE, 'utf8').split(/\r?\n/)
  expect(header).toBe('item_code,pack_volume_digit,internal_gtin')
  return rows
    .map((row, index) => ({ row, line: index + 2 }))
    .filter(({ row }) => row !== '')
    .map(({ row, line }) => {
      const match = /^"([^"]*)",([0-9]),([0-9]{14})$/.exec(row)
      if (!match) throw new Error(`Line ${line} is not "item_code",digit,gtin: ${JSON.stringify(row)}`)
      return { line, itemCode: match[1], packVolumeDigit: Number(match[2]), internalGtin: match[3] }
    })
}

const withCheckDigit = first13 => first13 + String(gs1CheckDigit(first13))

// ADR-0002 "Worked examples", verbatim.
const ADR_EXAMPLES = [
  { itemCode: 'PARA01', packVolumeDigit: 0, packVolumeMl: null, internalGtin: '00425873440010' },
  { itemCode: 'PARA18', packVolumeDigit: 0, packVolumeMl: null, internalGtin: '00425873440485' },
  { itemCode: 'PARA18', packVolumeDigit: 2, packVolumeMl: 60, internalGtin: '20425873440489' },
  { itemCode: 'AIR 01', packVolumeDigit: 0, packVolumeMl: null, internalGtin: '00410718656015' },
]

describe('shared test-case file test-vectors/internal-gtin-v1.csv', () => {
  const testCases = readTestCases()

  it('has every row (2,604 cases)', () => {
    expect(testCases).toHaveLength(2604)
  })

  it('every row encodes to its Internal GTIN and decodes back to itself', () => {
    const failures = []
    for (const { line, itemCode, packVolumeDigit, internalGtin } of testCases) {
      const encoded = encodeInternalGtin(itemCode, packVolumeDigit)
      if (!encoded.ok || encoded.internalGtin !== internalGtin || encoded.itemCode !== itemCode) {
        failures.push(`line ${line}: encode ${JSON.stringify(itemCode)}/${packVolumeDigit} → ${JSON.stringify(encoded)}`)
      }
      const decoded = decodeInternalGtin(internalGtin)
      const expected = { ok: true, itemCode, packVolumeDigit, packVolumeMl: packVolumeMlForDigit(packVolumeDigit) }
      if (JSON.stringify(decoded) !== JSON.stringify(expected)) {
        failures.push(`line ${line}: decode ${internalGtin} → ${JSON.stringify(decoded)}`)
      }
      // The scanning fast path must agree with the strict decoder on every row.
      if (internalGtinItemCode(internalGtin) !== itemCode) {
        failures.push(`line ${line}: fast path ${internalGtin} → ${internalGtinItemCode(internalGtin)}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('starts with the ADR-0002 worked examples', () => {
    expect(testCases.slice(0, 4).map(r => [r.itemCode, r.packVolumeDigit, r.internalGtin])).toEqual(
      ADR_EXAMPLES.map(e => [e.itemCode, e.packVolumeDigit, e.internalGtin])
    )
  })
})

describe('gs1CheckDigit', () => {
  it('computes the GS1 mod-10 check digit', () => {
    expect(gs1CheckDigit('400638133393')).toBe(1) // GTIN-13 4006381333931
    expect(gs1CheckDigit('0042587344001')).toBe(0)
    expect(gs1CheckDigit('0042587344048')).toBe(5)
    expect(gs1CheckDigit('2042587344048')).toBe(9)
  })
})

describe('Pack Volume table (ADR-0002)', () => {
  it('maps each digit to its nominal volume', () => {
    expect(PACK_VOLUMES.map(e => [e.digit, e.ml])).toEqual([[0, null], [1, 30], [2, 60], [3, 120], [4, 240], [5, 480]])
    expect(packVolumeDigitForMl(60)).toBe(2)
    expect(packVolumeDigitForMl(100)).toBe(0)
    expect(packVolumeDigitForMl(null)).toBe(0)
    expect(packVolumeMlForDigit(5)).toBe(480)
  })
})

describe('encodeInternalGtin', () => {
  it.each(ADR_EXAMPLES)('encodes $itemCode / $packVolumeDigit → $internalGtin', ({ itemCode, packVolumeDigit, internalGtin }) => {
    expect(encodeInternalGtin(itemCode, packVolumeDigit)).toEqual({ ok: true, internalGtin, itemCode, packVolumeDigit })
  })

  it('upper-cases lower-case a–z only', () => {
    expect(encodeInternalGtin('para01', 0)).toEqual(encodeInternalGtin('PARA01', 0))
    expect(encodeInternalGtin('ıTEM01', 0)).toMatchObject({ ok: false, reason: 'item-code-character' })
  })

  it.each(['', 'PARA1', 'PARA011', 'PARA01 '])('refuses %j: wrong length', itemCode => {
    expect(encodeInternalGtin(itemCode, 0)).toMatchObject({ ok: false, reason: 'item-code-length' })
  })

  it.each(['PARA0!', 'PARA_1', 'PARA/1', 'PARAé1'])('refuses %j: character outside the 40', itemCode => {
    expect(encodeInternalGtin(itemCode, 0)).toMatchObject({ ok: false, reason: 'item-code-character' })
  })

  it.each([6, 7, 8, 9, -1, 1.5, Number.NaN])('refuses Pack Volume digit %s', digit => {
    expect(encodeInternalGtin('PARA01', digit)).toMatchObject({ ok: false, reason: 'pack-volume-digit' })
  })
})

describe('decodeInternalGtin', () => {
  it.each(ADR_EXAMPLES)('decodes $internalGtin', ({ itemCode, packVolumeDigit, packVolumeMl, internalGtin }) => {
    expect(decodeInternalGtin(internalGtin)).toEqual({ ok: true, itemCode, packVolumeDigit, packVolumeMl })
  })

  it('decodes the one existing BCS gtins entry that passes the digit checks, to a non-item code', () => {
    expect(decodeInternalGtin('00402816304400')).toMatchObject({ ok: true, itemCode: '2U0J10' })
  })

  it('refuses non-v1 codes with a reason', () => {
    expect(decodeInternalGtin('0042587344001')).toMatchObject({ ok: false, reason: 'not-14-digits' })
    expect(decodeInternalGtin('00425873440011')).toMatchObject({ ok: false, reason: 'check-digit' })
    expect(decodeInternalGtin('04895126604715')).toMatchObject({ ok: false, reason: 'prefix' })
    expect(decodeInternalGtin(withCheckDigit('6042587344001'))).toMatchObject({ ok: false, reason: 'pack-volume-digit' })
    expect(decodeInternalGtin(withCheckDigit('9042587344001'))).toMatchObject({ ok: false, reason: 'pack-volume-digit' })
    expect(decodeInternalGtin(withCheckDigit(`004${FIRST_RESERVED_ITEM_NUMBER}`))).toMatchObject({ ok: false, reason: 'reserved-range' })
  })

  it('round-trips every character in every position', () => {
    for (let position = 0; position < 6; position++) {
      for (const character of ITEM_CODE_CHARACTERS) {
        const itemCode = 'PARA01'.slice(0, position) + character + 'PARA01'.slice(position + 1)
        const encoded = encodeInternalGtin(itemCode, 3)
        expect(encoded.ok).toBe(true)
        expect(decodeInternalGtin(encoded.internalGtin)).toMatchObject({ ok: true, itemCode, packVolumeDigit: 3 })
      }
    }
  })
})

describe('scanning fast path (ADR-0002 "Recognising an Internal GTIN")', () => {
  it('decodes digit 1 = 0–8 (6–8 are future Pack Volumes, still the same item)', () => {
    for (const v of ['0', '1', '5', '6', '7', '8']) {
      expect(internalGtinItemCode(withCheckDigit(`${v}042587344001`))).toBe('PARA01')
    }
  })

  it('rejects digit 1 = 9, a wrong check digit, the reserved range and other prefixes', () => {
    expect(internalGtinItemCode(withCheckDigit('9042587344001'))).toBeNull()
    expect(internalGtinItemCode('00425873440011')).toBeNull()
    expect(internalGtinItemCode(withCheckDigit('0049999999999'))).toBeNull()
    expect(internalGtinItemCode('04895126604715')).toBeNull()
    expect(internalGtinItemCode('0042587344001')).toBeNull()
    expect(internalGtinItemCode(null)).toBeNull()
  })

  it('recognises 04 in digits 2–3 regardless of the check digit', () => {
    expect(hasInternalGtinPrefix('00425873440011')).toBe(true)
    expect(hasInternalGtinPrefix('90425873440010')).toBe(true)
    expect(hasInternalGtinPrefix('04895126604715')).toBe(false)
    expect(hasInternalGtinPrefix('0425873440010')).toBe(false)
  })
})

describe('Pack Volume from a product record', () => {
  it.each([
    ['60ML', 2], ['60 mL', 2], [' 120ml ', 3], ['30ML', 1], ['240 ML', 4], ['480mL', 5],
    ['', 0], [null, 0], ['100ML', 0], ['60', 0], ['60 TAB', 0], ['2 x 60ML', 0], ['60MLX2', 0], ['0.5ML', 0],
  ])('%j → %i', (text, digit) => {
    expect(packVolumeDigitFromText(text)).toBe(digit)
  })

  it('takes the one volume a record states, and 0 when none or two disagree', () => {
    expect(packVolumeDigitForRecord({ itemCode: 'AUGM02', prefix: 'A156', packSize: '60ML' })).toBe(2)
    expect(packVolumeDigitForRecord({ itemCode: 'ORAL01', prefix: 'ORS', volume: '120 mL' })).toBe(3)
    expect(packVolumeDigitForRecord({ drugCode: 'PARA05', prefix: 'PP', unit: 'TAB' })).toBe(0)
    expect(packVolumeDigitForRecord({ itemCode: 'AUGM02', packSize: '' })).toBe(0)
    expect(packVolumeDigitForRecord({ packSize: '60ML', volume: '120ML' })).toBe(0)
    expect(packVolumeDigitForRecord({ packSize: '60ML', volume: '60 mL' })).toBe(2)
    expect(packVolumeDigitForRecord(null)).toBe(0)
  })
})
