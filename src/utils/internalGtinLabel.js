// GS1 element string for an Internal GTIN label: AI (01) the Internal GTIN,
// AI (17) the Expiry, AI (10) the Lot — in that order, so the Lot is last and
// needs no trailing separator. Ported from the Tiny 2D-code Printing App
// (src/core/label.ts, lot.ts, expiry.ts) so RxStation's prepack / ABX /
// Extemp labels carry exactly what that app prints and BCS expects.
//
// Pure: no storage, no DOM, never reads the clock.

import { decodeInternalGtin, encodeInternalGtin } from './internalGtin'

// ── Lot ───────────────────────────────────────────────────────────────────────

/** Lot rules: `A–Z 0–9 - / ( )`, 1–20 characters. GS1 AI (10) allows more, but this set reads the same on every scanner. */
export const LOT_MAX_LENGTH = 20
export const LOT_PATTERN = /^[A-Z0-9\-/()]+$/

/** Trims, upper-cases a–z and checks a Lot as entered; returns the Lot to print. */
export function normaliseLot(input) {
  const refuse = message => ({ ok: false, message })
  // Upper-case ASCII a–z only: String.prototype.toUpperCase would turn e.g. "ı" into "I".
  const lot = String(input ?? '').trim().replace(/[a-z]/g, letter => letter.toUpperCase())

  if (lot === '') return refuse('Enter a Lot.')
  if (lot.includes(' ')) return refuse('GS1 cannot encode a space in a Lot.')
  const badCharacter = [...lot].find(character => !LOT_PATTERN.test(character))
  if (badCharacter !== undefined) {
    return refuse(`A Lot cannot contain ${JSON.stringify(badCharacter)}; only A–Z, 0–9, "-", "/", "(" and ")" are allowed.`)
  }
  if (lot.length > LOT_MAX_LENGTH) {
    return refuse(`A Lot can have at most ${LOT_MAX_LENGTH} characters; this one has ${lot.length}.`)
  }
  return { ok: true, lot }
}

/** True if `lot` is already a valid Lot exactly as it will be printed (no trimming or upper-casing needed). */
export function isPrintableLot(lot) {
  const result = normaliseLot(lot)
  return result.ok && result.lot === lot
}

// ── Expiry ────────────────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function daysInMonth(year, month) {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function validDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

const pad2 = value => String(value).padStart(2, '0')

/** AI (17) data `YYMMDD` for a date in 2000–2099. */
export function expiryToGs1({ year, month, day }) {
  return pad2(year % 100) + pad2(month) + pad2(day)
}

/**
 * Parses AI (17) data `YYMMDD` as 20YY. Refuses day 00 (GS1's "end of month"),
 * which is never printed (ADR-0001), and any impossible date.
 */
export function parseGs1Expiry(yymmdd) {
  if (typeof yymmdd !== 'string' || !/^[0-9]{6}$/.test(yymmdd)) return null
  return validDate(2000 + Number(yymmdd.slice(0, 2)), Number(yymmdd.slice(2, 4)), Number(yymmdd.slice(4, 6)))
}

/**
 * The Use Before text exactly as it is printed on a label → AI (17) `YYMMDD`,
 * or null when it is not a recognisable real date in 2000–2099. Accepted:
 *   `19 OCT 2027`, `5 SEPT 2027` (formatDateLabel — en-GB may say SEPT),
 *   `19-Oct-2027`, `19/10/2027`, `19-10-2027`, `19.10.2027`, `19102027`.
 * Day-first throughout (en-GB). The day is encoded as printed — never 00.
 */
export function expiryTextToYymmdd(text) {
  const s = String(text ?? '').trim()
  let day, month, year
  let m = /^(\d{1,2})[\s-]+([A-Za-z]{3,4})\.?[\s-]+(\d{4})$/.exec(s)
  if (m) {
    const name = m[2].toUpperCase()
    if (name.length === 4 && name !== 'SEPT') return null
    month = MONTHS.indexOf(name.slice(0, 3)) + 1
    if (month === 0) return null
    day = Number(m[1]); year = Number(m[3])
  } else if ((m = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/.exec(s))) {
    day = Number(m[1]); month = Number(m[3]); year = Number(m[4])
  } else if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(s))) {
    day = Number(m[1]); month = Number(m[2]); year = Number(m[3])
  } else {
    return null
  }
  if (year < 2000 || year > 2099) return null
  const date = validDate(year, month, day)
  return date ? expiryToGs1(date) : null
}

// ── Element string ────────────────────────────────────────────────────────────

/**
 * Strictly decodes an Internal GTIN label's element string: `01` + 14 digits,
 * `17` + 6 digits, `10` + the Lot (everything after AI 10), with a v1 Internal
 * GTIN, a real YYMMDD date (day 00 refused) and a Lot that is valid exactly as
 * printed. No symbology identifier, brackets or separators.
 */
export function decodeLabelData(elementString) {
  const refuse = message => ({ ok: false, message })
  const match = /^01([0-9]{14})17([0-9]{6})10(.+)$/s.exec(String(elementString ?? ''))
  if (!match) return refuse('The data is not 01 + 14-digit GTIN, 17 + 6-digit Expiry, 10 + Lot.')
  const [, internalGtin, expiryYymmdd, lot] = match

  const gtin = decodeInternalGtin(internalGtin)
  if (!gtin.ok) return refuse(gtin.message)
  if (!parseGs1Expiry(expiryYymmdd)) return refuse(`The Expiry ${expiryYymmdd} is not a real date (YYMMDD, day 01–31).`)
  if (!isPrintableLot(lot)) return refuse(`The Lot ${JSON.stringify(lot)} is not a valid Lot.`)

  return {
    ok: true,
    data: {
      internalGtin,
      itemCode: gtin.itemCode,
      packVolumeDigit: gtin.packVolumeDigit,
      packVolumeMl: gtin.packVolumeMl,
      expiryYymmdd,
      lot,
    },
  }
}

/**
 * Builds the `(01)(17)(10)` data for a label and refuses it unless the
 * element string decodes back to exactly what the label shows (the same
 * self-check the Tiny 2D-code app runs before printing).
 *
 * The Lot must already be printable as is (A–Z 0–9 - / ( ), ≤ 20 characters):
 * the symbol has to carry the very characters printed beside it, so nothing is
 * trimmed or upper-cased here.
 *
 * @param {{ itemCode: string, packVolumeDigit: number, expiryYymmdd: string, lot: string }} input
 * @returns {{ ok: true, internalGtin: string, itemCode: string, packVolumeDigit: number,
 *             expiryYymmdd: string, lot: string, elementString: string, hri: string }
 *         | { ok: false, field: 'itemCode'|'packVolume'|'expiry'|'lot'|'selfCheck', message: string }}
 */
export function buildLabelElementString({ itemCode, packVolumeDigit, expiryYymmdd, lot }) {
  const refuse = (field, message) => ({ ok: false, field, message })

  const encoded = encodeInternalGtin(String(itemCode ?? '').trim(), packVolumeDigit)
  if (!encoded.ok) return refuse(encoded.reason === 'pack-volume-digit' ? 'packVolume' : 'itemCode', encoded.message)
  if (!parseGs1Expiry(expiryYymmdd)) return refuse('expiry', 'The Use Before date is not a recognisable date.')
  if (!isPrintableLot(lot)) {
    const checked = normaliseLot(lot)
    return refuse('lot', checked.ok ? 'The batch number must be upper case with no spaces.' : checked.message)
  }

  const label = {
    internalGtin: encoded.internalGtin,
    itemCode: encoded.itemCode,
    packVolumeDigit: encoded.packVolumeDigit,
    expiryYymmdd,
    lot,
    elementString: `01${encoded.internalGtin}17${expiryYymmdd}10${lot}`,
    hri: `(01)${encoded.internalGtin}(17)${expiryYymmdd}(10)${lot}`,
  }

  const decoded = decodeLabelData(label.elementString)
  if (!decoded.ok) return refuse('selfCheck', `Self-check failed: ${decoded.message}`)
  for (const key of ['internalGtin', 'itemCode', 'packVolumeDigit', 'expiryYymmdd', 'lot']) {
    if (decoded.data[key] !== label[key]) {
      return refuse('selfCheck', `Self-check failed: ${key} decodes to ${JSON.stringify(decoded.data[key])}, not ${JSON.stringify(label[key])}.`)
    }
  }
  return { ok: true, ...label }
}
