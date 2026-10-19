import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getItemDescription } from './storage'

function memoryStorage() {
  const m = new Map()
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: k => { m.delete(k) },
    clear: () => m.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  // Item list (PHQ) and an ABX row whose own description differs — shapes
  // copied from the live data file.
  localStorage.setItem('sml_drugs', JSON.stringify([
    { id: 'AUGM02', itemCode: 'AUGM02', name: 'AUGMENTIN (OR EQUIV) SYRUP 156MG/5ML', unit: 'SUS', isSpecial: false },
    { id: 'CEFU07', itemCode: 'CEFU07', name: 'CEFUROXIME (AXETIL) SUSPENSION 125MG/5ML', unit: 'SUS', isSpecial: false },
  ]))
  localStorage.setItem('sml_abx', JSON.stringify([
    { itemCode: 'AUGM02', prefix: 'A156', packSize: '', description: 'AMOXICILLIN + CLAVULANIC ACID SUSPENSION 156MG/5ML', id: '1' },
  ]))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getItemDescription', () => {
  it('returns the item-list description, not the ABX table description', () => {
    expect(getItemDescription('AUGM02')).toEqual({
      description: 'AUGMENTIN (OR EQUIV) SYRUP 156MG/5ML',
      found: true,
    })
  })

  it('matches the item code case-insensitively and ignores spaces', () => {
    expect(getItemDescription(' cefu07 ').description).toBe('CEFUROXIME (AXETIL) SUSPENSION 125MG/5ML')
  })

  it('falls back to the item code, flagged, when the code is not in the item list', () => {
    expect(getItemDescription('osel99')).toEqual({ description: 'OSEL99', found: false })
  })

  it('returns an empty description for an empty code', () => {
    expect(getItemDescription('')).toEqual({ description: '', found: false })
    expect(getItemDescription(undefined)).toEqual({ description: '', found: false })
  })
})
