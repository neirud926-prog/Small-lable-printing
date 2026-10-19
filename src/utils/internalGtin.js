// Internal GTIN codec, scheme v1 — a JavaScript port of the Tiny 2D-code
// Printing App's src/core/internalGtin.ts (ADR-0002 in
// neirud926-prog/Tiny-2Dcode-Printing-App). BCS, RxStation and the Tiny app
// must agree byte for byte, so keep this file in step with that one and with
// test-vectors/internal-gtin-v1.csv.
//
//   V | 0 4 | N N N N N N N N N N | C
//   V   Pack Volume digit
//   04  GS1 prefix for restricted circulation within a company
//   N   Item Code as a base-40 number, zero-padded to 10 digits
//   C   GS1 mod-10 check digit
//
// Pure: no storage, no DOM. Once labels are printed this scheme cannot change.

/** The 40 characters an Item Code may contain; a character's index is its value. Fixed forever. */
export const ITEM_CODE_CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ -&.'

export const ITEM_CODE_LENGTH = 6

/** GS1 prefix for restricted circulation within a company; never issued to manufacturers. */
export const INTERNAL_GTIN_PREFIX = '04'

/** 40⁶: the first N reserved for a future version. v1 never produces N at or above it. */
export const FIRST_RESERVED_ITEM_NUMBER = 4_096_000_000

/**
 * Pack Volume digit V → nominal fill volume in mL. Digit 0 means no volume is
 * encoded (a non-liquid, or a volume not listed). Digits 6–8 are reserved for
 * future volumes (only by a new ADR); 9 is never used.
 */
export const PACK_VOLUMES = Object.freeze([
  Object.freeze({ digit: 0, ml: null }),
  Object.freeze({ digit: 1, ml: 30 }),
  Object.freeze({ digit: 2, ml: 60 }),
  Object.freeze({ digit: 3, ml: 120 }),
  Object.freeze({ digit: 4, ml: 240 }),
  Object.freeze({ digit: 5, ml: 480 }),
])

/** The Pack Volume digit for a volume in mL; 0 when there is no volume or it is not listed. */
export function packVolumeDigitForMl(ml) {
  const entry = PACK_VOLUMES.find(e => e.ml !== null && e.ml === ml)
  return entry ? entry.digit : 0
}

/** The nominal volume in mL for a Pack Volume digit; null for digit 0 (no volume encoded). */
export function packVolumeMlForDigit(digit) {
  return PACK_VOLUMES[digit].ml
}

function isPackVolumeDigit(value) {
  return Number.isInteger(value) && value >= 0 && value < PACK_VOLUMES.length
}

/** GS1 mod-10 check digit for a digit string that excludes the check digit (e.g. 13 digits of a GTIN-14). */
export function gs1CheckDigit(digits) {
  let sum = 0
  // Weights alternate 3, 1, 3, ... starting from the rightmost digit.
  for (let i = 0; i < digits.length; i++) {
    const digit = digits.charCodeAt(digits.length - 1 - i) - 48
    sum += i % 2 === 0 ? digit * 3 : digit
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Encodes an Item Code and Pack Volume digit as a 14-digit Internal GTIN.
 * Lower-case a–z is upper-cased first; any other character outside the 40 is
 * refused. The returned `itemCode` is the upper-cased Item Code that was encoded.
 *
 * @returns {{ ok: true, internalGtin: string, itemCode: string, packVolumeDigit: number }
 *         | { ok: false, reason: 'item-code-length'|'item-code-character'|'pack-volume-digit', message: string }}
 */
export function encodeInternalGtin(itemCode, packVolumeDigit) {
  const refuse = (reason, message) => ({ ok: false, reason, message })

  if (typeof itemCode !== 'string' || itemCode.length !== ITEM_CODE_LENGTH) {
    const length = typeof itemCode === 'string' ? itemCode.length : 0
    return refuse('item-code-length', `Item Code must be exactly 6 characters; got ${length}.`)
  }
  // Upper-case ASCII a–z only: String.prototype.toUpperCase would turn e.g. "ı" into "I".
  const upperCased = itemCode.replace(/[a-z]/g, letter => letter.toUpperCase())

  let n = 0
  for (const character of upperCased) {
    const value = ITEM_CODE_CHARACTERS.indexOf(character)
    if (value < 0) {
      return refuse(
        'item-code-character',
        `Item Code "${itemCode}" contains ${JSON.stringify(character)}; ` +
          'only 0–9, A–Z, space, "-", "&" and "." are allowed.'
      )
    }
    n = n * ITEM_CODE_CHARACTERS.length + value
  }

  if (!isPackVolumeDigit(packVolumeDigit)) {
    return refuse('pack-volume-digit', `Pack Volume digit must be 0–5; got ${packVolumeDigit}.`)
  }

  const first13Digits = `${packVolumeDigit}${INTERNAL_GTIN_PREFIX}${String(n).padStart(10, '0')}`
  return {
    ok: true,
    internalGtin: first13Digits + String(gs1CheckDigit(first13Digits)),
    itemCode: upperCased,
    packVolumeDigit,
  }
}

/** Base-40 digits of N (10 decimal digits, N < 40⁶) → the 6-character Item Code. */
function itemCodeFromNumber(n) {
  let itemCode = ''
  for (let i = 0; i < ITEM_CODE_LENGTH; i++) {
    itemCode = ITEM_CODE_CHARACTERS[n % ITEM_CODE_CHARACTERS.length] + itemCode
    n = Math.floor(n / ITEM_CODE_CHARACTERS.length)
  }
  return itemCode
}

/**
 * Decodes a 14-digit GTIN back to Item Code and Pack Volume, refusing anything
 * that is not a v1 Internal GTIN. Whether the Item Code exists in the item list
 * is the caller's question.
 *
 * @returns {{ ok: true, itemCode: string, packVolumeDigit: number, packVolumeMl: number|null }
 *         | { ok: false, reason: 'not-14-digits'|'check-digit'|'prefix'|'pack-volume-digit'|'reserved-range', message: string }}
 */
export function decodeInternalGtin(gtin) {
  const refuse = (reason, message) => ({ ok: false, reason, message })

  if (typeof gtin !== 'string' || !/^[0-9]{14}$/.test(gtin)) {
    return refuse('not-14-digits', 'A GTIN must be exactly 14 digits.')
  }
  const expectedCheckDigit = gs1CheckDigit(gtin.slice(0, 13))
  if (Number(gtin[13]) !== expectedCheckDigit) {
    return refuse('check-digit', `Check digit is ${gtin[13]}, but should be ${expectedCheckDigit}.`)
  }
  if (gtin.slice(1, 3) !== INTERNAL_GTIN_PREFIX) {
    return refuse('prefix', `Not an Internal GTIN: digits 2–3 are "${gtin.slice(1, 3)}", not "04".`)
  }
  const packVolumeDigit = Number(gtin[0])
  if (!isPackVolumeDigit(packVolumeDigit)) {
    return refuse(
      'pack-volume-digit',
      packVolumeDigit === 9
        ? 'Not an Internal GTIN: digit 1 is 9 (GS1 variable measure).'
        : `Not a v1 Internal GTIN: Pack Volume digit ${packVolumeDigit} is reserved for a future version.`
    )
  }
  const n = Number(gtin.slice(3, 13))
  if (n >= FIRST_RESERVED_ITEM_NUMBER) {
    return refuse('reserved-range', 'Not a v1 Internal GTIN: its Item Code number is in the reserved range.')
  }
  return { ok: true, itemCode: itemCodeFromNumber(n), packVolumeDigit, packVolumeMl: packVolumeMlForDigit(packVolumeDigit) }
}

// ── Scanning (ADR-0002 "Recognising an Internal GTIN when scanned") ──────────

/** True when digits 2–3 of a 14-digit GTIN are `04` — such a GTIN never gets the last-6-digits fallback. */
export function hasInternalGtinPrefix(gtin) {
  return typeof gtin === 'string' && /^[0-9]{14}$/.test(gtin) && gtin.slice(1, 3) === INTERNAL_GTIN_PREFIX
}

/**
 * The fast-path digit checks: digit 1 is 0–8, digits 2–3 are `04`, the check
 * digit is valid and N < 4,096,000,000. Returns the Item Code N decodes to, or
 * null. The caller still has to confirm the Item Code is in the item list
 * before treating the GTIN as an Internal GTIN. Digits 6–8 are accepted here
 * (unlike decodeInternalGtin) so a label using a future Pack Volume still
 * resolves to its item.
 */
export function internalGtinItemCode(gtin) {
  if (!hasInternalGtinPrefix(gtin)) return null
  if (gtin[0] === '9') return null
  if (Number(gtin[13]) !== gs1CheckDigit(gtin.slice(0, 13))) return null
  const n = Number(gtin.slice(3, 13))
  if (n >= FIRST_RESERVED_ITEM_NUMBER) return null
  return itemCodeFromNumber(n)
}

// ── Pack Volume from a product record (RxStation) ────────────────────────────

/**
 * The Pack Volume digit for a free-text volume field, only when the field
 * clearly states one of the listed volumes — the whole field is a number plus
 * "mL" in any case, e.g. `60ML`, `60 mL`, `120ml`. Anything else
 * (blank, `100ML`, `60`, `60 TAB`, `2 x 60ML`) gives 0.
 */
export function packVolumeDigitFromText(text) {
  const m = /^\s*(\d+)\s*ml\s*$/i.exec(text == null ? '' : String(text))
  return m ? packVolumeDigitForMl(Number(m[1])) : 0
}

/**
 * Pack Volume digit for an ABX / Prepack / Extemp record: looks at the
 * record's volume-like fields (`packSize`, `volume`, `unit`). If they clearly
 * state exactly one listed volume, its digit; if none do, or two disagree, 0.
 */
export function packVolumeDigitForRecord(record) {
  if (!record) return 0
  const digits = new Set(
    ['packSize', 'volume', 'unit']
      .map(field => packVolumeDigitFromText(record[field]))
      .filter(digit => digit !== 0)
  )
  return digits.size === 1 ? [...digits][0] : 0
}
