// Storage-aware wrapper around resolveScannedGtin() (barcodeDecoder.js, which
// stays storage-agnostic): a GTIN scan → item code using this PC's item list
// and GTIN map. One place for every scan-aware screen.

import { resolveScannedGtin } from './barcodeDecoder'
import { findByGtin, findDrugByCode } from './storage'

/**
 * `scan` is classifyScannedInput()'s { decoded, rawBarcode } for a 'gtin' input.
 * An Internal GTIN is accepted when its Item Code is in the item list — or,
 * when given, passes `alsoItemCode(code)` (e.g. the Prepack list).
 * Returns resolveScannedGtin()'s { itemCode, source, gtin, lot, exp }.
 */
export function resolveGtinScan(scan, { alsoItemCode } = {}) {
  return resolveScannedGtin(scan, {
    findByGtin,
    isItemCode: code => !!findDrugByCode(code) || (typeof alsoItemCode === 'function' && alsoItemCode(code)),
  })
}
