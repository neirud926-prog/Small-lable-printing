// Port of MReadingBarCode.bas — GS1/Distributor barcode decoding
// Returns array: [gtin, lot, exp] where exp is YYMMDD string

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

export function isResultValid(result) {
  if (!result || result[0] === false || result[0] === null) return false
  const [gtin, lot, exp] = result
  return (
    typeof gtin === 'string' && gtin.length === 14 &&
    typeof exp === 'string' && exp.length === 6 &&
    typeof lot === 'string' && lot.length > 0
  )
}

export function decodeBarcode(barcode) {
  if (!barcode) return null
  barcode = barcode.trim()

  if (barcode.length <= 16) {
    return algoTestP0(barcode)
  }

  // Try P0 first
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
  if (barcode.length >= 16) {
    return [barcode.substring(2, 16), 'na----', 'na----']
  }
  return null
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
