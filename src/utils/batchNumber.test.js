import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateBatchNo, commitBatchNo } from './batchNumber'
import { getBatchCounters, resetCounter, getTodayItemCounters, addBatchRecord } from './storage'

// In-memory localStorage — storage.js falls back to it when neither the
// Tauri file nor the File System Access handle is connected (as in tests).
function memoryStorage() {
  const m = new Map()
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: k => { m.delete(k) },
    clear: () => m.clear(),
  }
}

// Print one lot the way the Reconstitution tabs do: generate the number,
// save the batch record, then commit the counter.
function printLot(location, prefix, itemCode) {
  const bn = generateBatchNo(location, prefix, true, itemCode)
  addBatchRecord({
    date: new Date().toLocaleDateString('en-CA'),
    location, itemCode, batchNo: bn, status: 'In Use',
  })
  commitBatchNo(location, itemCode, bn)
  return bn
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 19, 10, 0, 0)) // 19 Oct 2026 → 261019
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('lot number sequence is counted per item', () => {
  it('a different item on the same day starts at 01 (AUGM06 then AUGM02)', () => {
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101901')
    expect(printLot('IPOP', 'A156', 'AUGM02')).toBe('A156-26101901')
  })

  it('a second lot of the same item the same day gets 02', () => {
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101901')
    expect(printLot('IPOP', 'A156', 'AUGM02')).toBe('A156-26101901')
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101902')
    expect(printLot('IPOP', 'A156', 'AUGM02')).toBe('A156-26101902')
  })

  it('does not skip a number when the record is saved before the counter is committed', () => {
    // First lot of the day for this item: the record is already in history
    // when commitBatchNo runs, so the next lot must still be 02, not 03.
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101901')
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101902')
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101903')
  })

  it('commit without a batch number still advances the item counter', () => {
    commitBatchNo('IPOP', 'AUGM06')
    expect(generateBatchNo('IPOP', 'A457', true, 'AUGM06')).toBe('A457-26101902')
    expect(generateBatchNo('IPOP', 'A156', true, 'AUGM02')).toBe('A156-26101901')
  })

  it('previewing without printing does not consume a number', () => {
    expect(generateBatchNo('IPOP', 'A457', true, 'AUGM06')).toBe('A457-26101901')
    expect(generateBatchNo('IPOP', 'A457', true, 'AUGM06')).toBe('A457-26101901')
  })

  it('item code matching is case-insensitive', () => {
    expect(printLot('IPOP', 'A457', 'augm06')).toBe('A457-26101901')
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101902')
  })

  it('restarts at 01 on the next day', () => {
    printLot('IPOP', 'A457', 'AUGM06')
    printLot('IPOP', 'A457', 'AUGM06')
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0, 0))
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26102001')
  })

  it('EC and IP/OP keep separate sequences, as before', () => {
    printLot('IPOP', 'A457', 'AUGM06')
    expect(printLot('EC', 'A457', 'AUGM06')).toBe('A457-26101901')
  })

  it('works without a prefix (Prepack / Extemp with no prefix set)', () => {
    expect(generateBatchNo('EC', '', false, 'ORAL01')).toBe('26101901')
  })

  it('goes past 99 without truncating', () => {
    resetCounter('IPOP', 'AUGM06', 100)
    expect(generateBatchNo('IPOP', 'A457', true, 'AUGM06')).toBe('A457-261019100')
  })
})

describe('existing stored counters and records', () => {
  it('ignores the old shared location counter and leaves it untouched', () => {
    const legacy = { EC: 1, IPOP: { date: '261019', n: 9 } }
    localStorage.setItem('sml_batchCounters', JSON.stringify(legacy))

    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101901')

    const after = getBatchCounters()
    expect(after.EC).toBe(1)
    expect(after.IPOP).toEqual({ date: '261019', n: 9 })
    expect(after['IPOP:AUGM06']).toEqual({ date: '261019', n: 2 })
  })

  it('on upgrade day, continues after numbers already issued today for that item', () => {
    // Lots printed earlier today by the old version (shared IPOP counter).
    addBatchRecord({ date: '2026-10-19', location: 'IPOP', itemCode: 'AUGM06', batchNo: 'A457-26101901', status: 'In Use' })
    addBatchRecord({ date: '2026-10-19', location: 'IPOP', itemCode: 'FLUC06', batchNo: 'FLZ-26101902', status: 'In Use' })
    addBatchRecord({ date: '2026-10-19', location: 'IPOP', itemCode: 'AUGM06', batchNo: 'A457-26101903', status: 'Cancel Order' })
    // Yesterday and other-location records must not count.
    addBatchRecord({ date: '2026-10-18', location: 'IPOP', itemCode: 'AUGM02', batchNo: 'A156-26101807', status: 'In Use' })
    addBatchRecord({ date: '2026-10-19', location: 'EC',   itemCode: 'AUGM02', batchNo: 'A156-26101905', status: 'In Use' })

    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101904')
    expect(printLot('IPOP', 'A156', 'AUGM02')).toBe('A156-26101901')
    expect(printLot('IPOP', 'A457', 'AUGM06')).toBe('A457-26101905')
  })
})

describe('resetCounter / getTodayItemCounters', () => {
  it('resets only the chosen item', () => {
    printLot('IPOP', 'A457', 'AUGM06')
    printLot('IPOP', 'A457', 'AUGM06')
    printLot('IPOP', 'A156', 'AUGM02')

    expect(resetCounter('IPOP', 'AUGM06', 1)).toBe(1)
    expect(generateBatchNo('IPOP', 'A457', true, 'AUGM06')).toBe('A457-26101901')
    expect(generateBatchNo('IPOP', 'A156', true, 'AUGM02')).toBe('A156-26101902')
  })

  it("lists today's per-item counters only", () => {
    localStorage.setItem('sml_batchCounters', JSON.stringify({
      EC: 1,
      IPOP: { date: '261019', n: 9 },
      'IPOP:FLUC06': { date: '261018', n: 4 },
    }))
    printLot('IPOP', 'A457', 'AUGM06')
    printLot('EC', 'A156', 'AUGM02')

    expect(getTodayItemCounters()).toEqual([
      { location: 'EC',   itemCode: 'AUGM02', n: 2 },
      { location: 'IPOP', itemCode: 'AUGM06', n: 2 },
    ])
  })
})
