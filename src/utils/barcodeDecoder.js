// GS1/Distributor barcode decoding
// Returns array: [gtin, lot, exp] where exp is YYMMDD string
//
// Two decode methods available:
//   'gs1'    — proper GS1 Application Identifier parser (default)
//   'legacy' — original positional P0–P6 patterns (kept as fallback)
//
// Supported AIs: 01/02 → GTIN, 10 → batch, 15/17 → expiry
//                11 (production date), 21 (serial), 90 (internal) — parsed, not used on label
//
// Pass method as second argument to decodeBarcode(), or rely on the
// default which reads from the app settings.

// ── GS1 AI lookup tables ──────────────────────────────────────────────────────
// Fixed-length AIs: key = AI string, value = data byte count after the AI
const GS1_FIXED = {
  '00': 18,  // SSCC
  '01': 14,  // GTIN-14
  '02': 14,  // GTIN of contained trade item
  '11': 6,   // Production date YYMMDD
  '12': 6,   // Due date YYMMDD
  '13': 6,   // Packaging date YYMMDD
  '15': 6,   // Best before date YYMMDD
  '16': 6,   // Sell by date YYMMDD
  '17': 6,   // Expiry date YYMMDD
  '18': 6,   // Production variant
  '19': 6,   // Sell by YYMMDD
  '20': 2,   // Variant number
  '31': 6, '32': 6, '33': 6, '34': 6, '35': 6, '36': 6,  // Measures
  '41': 13,  // EAN/UCC
}
// Variable-length AIs (terminated by FNC1 \u001d unless last field)
const GS1_VARIABLE = new Set([
  '10',  // Batch / Lot number
  '21',  // Serial number
  '22',  // Secondary data
  '30',  // Count
  '37',  // Count of trade items
  '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', // Internal use
])

// ── GS1 AI parser ─────────────────────────────────────────────────────────────

/**
 * When a variable-length field has no FNC1 terminator, scan forward from
 * startPos looking for the next plausible AI boundary.
 *
 * Two-pass scan:
 *   1. Prefer date AIs 11 / 15 / 17 with a valid YYMMDD that follows
 *      (month 01-12, day 00-31). The validation makes these reliable.
 *   2. Fall back to looser AI patterns (21, 90-99) only if no date AI is
 *      found. Done as a second pass so that a stray "21" or "9X" digit
 *      pair inside the batch can't pre-empt the real expiry AI a few
 *      positions later.
 *
 * Returns the index within s of the next AI start, or -1 if not found.
 *
 * Examples (batch portion shown):
 *   "A520005A11727123190HK-28748"  — pass 1 finds "17" at pos 9 (271231 valid)
 *   "25R0891728070190HK-45024"     — pass 1 finds "17" at pos 6 (280701 valid),
 *                                    NOT "91" at pos 5
 *   "5616005A21728083190HK-54320"  — pass 1 finds "17" at pos 9 (280831 valid),
 *                                    NOT "21" at pos 8
 */
function findNextAIBoundary(s, startPos) {
  for (let pos = startPos; pos < s.length - 1; pos++) {
    const ai = s.substring(pos, pos + 2)
    if (ai === '11' || ai === '15' || ai === '17') {
      if (pos + 8 <= s.length) {
        const mm = parseInt(s.substring(pos + 4, pos + 6), 10)
        const dd = parseInt(s.substring(pos + 6, pos + 8), 10)
        if (mm >= 1 && mm <= 12 && dd >= 0 && dd <= 31) return pos
      }
    }
  }
  for (let pos = startPos; pos < s.length - 1; pos++) {
    const ai = s.substring(pos, pos + 2)
    if (/^9[0-9]$/.test(ai)) return pos
    if (ai === '21') return pos
  }
  return -1
}

/**
 * Parse a GS1 barcode string into a map of Application Identifiers.
 * Handles:
 *   - Symbology identifiers: ]C1 (GS1-128), ]d2 (Data Matrix), ]Q3 (QR)
 *   - FNC1 separator: ASCII 29 (\u001d) or ^ substitute
 *   - Variable-length fields with no FNC1 (uses AI-boundary lookahead)
 * Returns null if the string doesn't look like a GS1 AI stream.
 */
function parseGS1AIs(raw) {
  let s = raw

  // Strip GS1 symbology identifiers emitted by some scanners
  s = s.replace(/^\]([CdQe][\dA-Fa-f]|[CdQe]\d{2})/, '')

  // Normalise FNC1: some scanners substitute ^ for the invisible ASCII 29
  const FNC1 = '\u001d'
  s = s.replace(/\^/g, FNC1)

  // Must start with a known AI prefix to qualify as a GS1 stream
  const knownStart = ['00', '01', '02', '10', '11', '15', '17', '20', '21', '30']
  if (!knownStart.some(ai => s.startsWith(ai))) return null

  const ais = {}
  let i = 0

  while (i < s.length) {
    // Skip FNC1 separators between fields
    if (s[i] === FNC1) { i++; continue }

    let matched = false

    // Try 4-char AI first, then 3-char, then 2-char (longest match wins)
    for (const alen of [4, 3, 2]) {
      if (i + alen > s.length) continue
      const ai = s.substring(i, i + alen)

      if (GS1_FIXED[ai] !== undefined) {
        // Fixed-length field — consume exactly that many data bytes
        ais[ai] = s.substring(i + alen, i + alen + GS1_FIXED[ai])
        i += alen + GS1_FIXED[ai]
        matched = true
        break
      }

      if (GS1_VARIABLE.has(ai)) {
        // Variable-length field — read until FNC1; if absent, use AI-boundary
        // lookahead so variable fields don't swallow subsequent AIs.
        const end = s.indexOf(FNC1, i + alen)
        if (end !== -1) {
          ais[ai] = s.substring(i + alen, end)
          i = end + 1
        } else {
          const boundary = findNextAIBoundary(s, i + alen)
          ais[ai] = boundary !== -1 ? s.substring(i + alen, boundary) : s.substring(i + alen)
          i = boundary !== -1 ? boundary : s.length
        }
        matched = true
        break
      }
    }

    // Unknown AI — stop parsing (don't corrupt the map with garbage)
    if (!matched) break
  }

  return Object.keys(ais).length > 0 ? ais : null
}

/**
 * Normalise a GTIN to 14 digits.
 * EAN-13 (13 digits) → prepend '0'
 * Shorter codes        → left-pad with zeros up to 14
 */
export function normaliseGtin(gtin) {
  if (!gtin) return gtin
  let g = gtin.trim()
  while (g.length < 14) g = '0' + g
  return g.length === 14 ? g : g.substring(g.length - 14) // keep last 14 if longer
}

// ── GS1 decode (new) ──────────────────────────────────────────────────────────
function decodeGs1(barcode) {
  // 1. Plain 14-digit GTIN (no AIs, no extra data)
  if (/^\d{14}$/.test(barcode)) {
    return [barcode, 'na----', 'na----']
  }

  // 2. Short numeric → normalise to GTIN-14 (e.g. EAN-13, EAN-8)
  if (/^\d{8,13}$/.test(barcode)) {
    return [normaliseGtin(barcode), 'na----', 'na----']
  }

  // 3. Full GS1 AI stream
  const ais = parseGS1AIs(barcode)
  // AI 01 = GTIN-14; AI 02 = GTIN of contained trade items (use as fallback)
  if (ais && (ais['01'] || ais['02'])) {
    const gtin = normaliseGtin(ais['01'] || ais['02'])
    const lot  = ais['10'] || 'na----'
    // AI 17 = expiry date, AI 15 = best-before date.
    // AI 11 is production date — NOT expiry; ignore for label purposes.
    // AI 21 = serial number, AI 90 = company internal — both ignored.
    const exp  = ais['17'] || ais['15'] || 'na----'
    return [gtin, lot, exp]
  }

  return null  // could not decode
}

// ── Legacy positional patterns (P0–P6) ───────────────────────────────────────
// Original port of MReadingBarCode.bas — kept verbatim as fallback

function patternFound(barcode, tagA, tagB, diff) {
  const posA = []
  const posB = []
  let idx = 0
  while (true) {
    const found = barcode.indexOf(tagA, idx + 1)
    if (found === -1) break
    posA.push(found)
    idx = found
  }
  idx = posA.length > 0 ? posA[0] : 0
  while (true) {
    const found = barcode.indexOf(tagB, idx + 1)
    if (found === -1) break
    if (found > (posA[0] || 0)) posB.push(found)
    idx = found
  }
  for (let i = 0; i < posA.length; i++) {
    for (let r = 0; r < posB.length; r++) {
      if (posB[r] - posA[i] === diff) {
        return [posA[i], posB[r]]
      }
    }
  }
  return [0, 0]
}

function algoTestP0(barcode) {
  const result = [null, null, null]
  if (barcode.length <= 16) {
    let gtin = barcode
    while (gtin.length < 14) gtin = '0' + gtin
    if (gtin.length >= 14) gtin = gtin.substring(2, 16)
    result[0] = gtin
    result[1] = 'na----'
    result[2] = 'na----'
  } else {
    result[0] = barcode.substring(2, 16)
    const iTag90 = barcode.indexOf('90HK')
    if (barcode.substring(0, 2) === '01' && barcode.substring(16, 18) === '10') {
      if (iTag90 > 0) {
        if (barcode.substring(16, 18) === '10') {
          result[1] = barcode.substring(18, iTag90 - 27 + 18)
        }
        if (barcode.substring(iTag90 - 8, iTag90 - 6) === '17') {
          result[2] = barcode.substring(iTag90 - 6, iTag90)
        }
      }
    } else if (barcode.substring(0, 2) === '01' && barcode.substring(16, 18) === '17') {
      let batchLen = 26
      if (iTag90 > 0) batchLen += 10
      if (barcode.substring(24, 26) === '10') {
        let temp = barcode.substring(26, barcode.length - batchLen + 26)
        const tag21pos = temp.indexOf('21')
        if (temp.length > 7 && tag21pos !== -1) {
          result[1] = temp.substring(0, tag21pos)
        } else {
          result[1] = temp
        }
      }
      if (barcode.substring(16, 18) === '17') {
        result[2] = barcode.substring(18, 24)
      }
    }
  }
  return result
}

function algoTestP1(barcode) {
  const result = [false, null, null]
  const [tag17, tag10] = patternFound(barcode, '17', '10', 8)
  if (tag10 - tag17 === 8) {
    result[0] = barcode.substring(2, 16)
    result[2] = barcode.substring(tag17 + 2, tag17 + 8)
    const tag21 = barcode.indexOf('21', tag10 + 2)
    if (tag21 !== -1 && barcode.substring(tag10 + 2, tag10 + 16).includes('21')) {
      result[1] = barcode.substring(tag10 + 2, tag21)
    } else {
      result[1] = barcode.substring(tag10 + 2)
    }
    return result
  }
  result[0] = false
  return result
}

function algoTestP2(barcode) {
  const result = [false, null, null]
  const [tag17, tag11] = patternFound(barcode, '17', '11', 8)
  if (tag11 - tag17 === 8) {
    result[0] = barcode.substring(2, 16)
    result[2] = barcode.substring(tag17 + 2, tag17 + 8)
    let tag10 = tag11
    for (let r = 0; r < 3; r++) {
      tag10 = barcode.indexOf('10', tag10 + 1)
      if (tag10 !== -1 && tag10 - tag11 === 8) {
        result[1] = barcode.substring(tag10 + 2)
        return result
      }
    }
  }
  result[0] = false
  return result
}

function algoTestP3(barcode) {
  const result = [false, null, null]
  const len = barcode.length
  if (barcode.substring(len - 8, len - 6) !== '17') return result
  const [tag11, tag17] = patternFound(barcode, '11', '17', 8)
  if (tag17 - tag11 === 8) {
    result[0] = barcode.substring(2, 16)
    result[2] = barcode.substring(len - 6)
    result[1] = barcode.substring(18, len - 34)
    return result
  }
  if (barcode.substring(16, 18) === '10' && len - 26 < 11) {
    result[0] = barcode.substring(2, 16)
    result[2] = barcode.substring(len - 6)
    result[1] = barcode.substring(18, len - 26)
    return result
  }
  result[0] = false
  return result
}

function algoTestP4(barcode) {
  const result = [false, null, null]
  const len = barcode.length
  if (barcode.substring(len - 16, len - 14) === '17' && barcode.substring(len - 8, len - 6) === '11') {
    result[0] = barcode.substring(2, 16)
    result[1] = barcode.substring(18, len - 34)
    result[2] = barcode.substring(len - 14, len - 8)
    return result
  }
  result[0] = false
  return result
}

function algoTestP5(barcode) {
  const result = [false, null, null]
  const [tag17, tag21] = patternFound(barcode, '17', '21', 8)
  if (tag21 - tag17 === 8) {
    result[0] = barcode.substring(2, 16)
    result[1] = barcode.substring(18, tag17)
    result[2] = barcode.substring(tag17 + 2, tag17 + 8)
    return result
  }
  result[0] = false
  return result
}

function algoTestP6(barcode) {
  const result = [false, null, null]
  const [tag10, tag15] = patternFound(barcode, '10', '15', 8)
  if (tag15 - tag10 === 8) {
    result[0] = barcode.substring(2, 16)
    result[1] = barcode.substring(18, 24)
    result[2] = barcode.substring(tag15 + 2, tag15 + 8)
    return result
  }
  result[0] = false
  return result
}

function decodeLegacy(barcode) {
  if (barcode.length <= 16) return algoTestP0(barcode)

  let result = algoTestP0(barcode)
  if (isResultValid(result)) return result

  const len = barcode.length
  if (barcode.substring(len - 8, len - 6) === '17') {
    result = algoTestP3(barcode)
    if (isResultValid(result)) return result
  } else if (barcode.substring(len - 16, len - 14) === '17' && barcode.substring(len - 8, len - 6) === '11') {
    result = algoTestP4(barcode)
    if (isResultValid(result)) return result
  } else if (barcode.substring(len - 8, len - 6) === '15') {
    result = algoTestP6(barcode)
    if (isResultValid(result)) return result
  } else {
    result = algoTestP1(barcode)
    if (isResultValid(result)) return result
    result = algoTestP2(barcode)
    if (isResultValid(result)) return result
    result = algoTestP5(barcode)
    if (isResultValid(result)) return result
  }

  // Fallback: return GTIN only
  if (barcode.length >= 16) return [barcode.substring(2, 16), 'na----', 'na----']
  return null
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isResultValid(result) {
  if (!result || result[0] === false || result[0] === null) return false
  const [gtin, lot, exp] = result
  return (
    typeof gtin === 'string' && gtin.length === 14 &&
    typeof exp  === 'string' && exp.length === 6 &&
    typeof lot  === 'string' && lot.length > 0
  )
}

/**
 * Decode a barcode string.
 * @param {string} barcode  Raw scanner output
 * @param {string} method   'gs1' (default) | 'legacy'
 * @returns {[string, string, string] | null}  [gtin14, lot, expYYMMDD] or null
 */
export function decodeBarcode(barcode, method = 'gs1') {
  if (!barcode) return null
  barcode = barcode.trim()

  if (method === 'legacy') return decodeLegacy(barcode)

  // GS1 path — try new parser first, fall through to legacy on failure
  const gs1Result = decodeGs1(barcode)
  if (gs1Result) return gs1Result

  // Legacy fallback for non-standard barcodes the GS1 parser can't handle
  return decodeLegacy(barcode)
}

// Format exp YYMMDD → DD-Mon-YYYY  (e.g. "01-Jan-2028")
export function formatExpiry(exp) {
  if (!exp || exp === 'na----') return ''
  const yy = exp.substring(0, 2)
  const mm = exp.substring(2, 4)
  const dd = exp.substring(4, 6)
  const year = parseInt(yy) + 2000
  const date = new Date(year, parseInt(mm) - 1, parseInt(dd))
  const parts = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ')
  // parts = ['01', 'Jan', '2028'] — already title-case from en-GB locale
  return `${parts[0]}-${parts[1]}-${parts[2]}`
}
