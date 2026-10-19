import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args) => invoke(...args) }))

const {
  buildPrepackLabelHTML,
  buildExtempLabelHTML,
  buildReconstitutionLabelHTML,
  printReconstitutionLabel,
} = await import('./labelPrint')
const { buildLabelDataMatrix, dataMatrixSvg, MODULE_MM, QUIET_ZONE_MODULES } = await import('./labelDataMatrix')

const SETTINGS = { labelWidth: 34.4, labelHeight: 25, drugFontSize: 6, batchFontSize: 5, silentPrint: true, printerName: 'GX420t' }

const symbolFor = (region = 'bottom') => {
  const s = buildLabelDataMatrix({ itemCode: 'PARA01', record: null, expiryText: '19 APR 2027', lot: 'PP-26101901', settings: SETTINGS, region })
  if (!s.ok) throw new Error(s.message)
  return s
}

describe('Prepack / Extemp label HTML', () => {
  it('is unchanged when there is no symbol (setting off, or symbol left off)', () => {
    for (const html of [
      buildPrepackLabelHTML('PARACETAMOL TABLET 500MG', 'PP-26101901', '19 APR 2027', SETTINGS),
      buildPrepackLabelHTML('PARACETAMOL TABLET 500MG', 'PP-26101901', '19 APR 2027', SETTINGS, null),
      buildExtempLabelHTML('FLECAINIDE', 'FLE-26101901', '18 DEC 2026', 'Refrigerate', 'Shake well', '', SETTINGS),
    ]) {
      expect(html).not.toContain('<svg')
      expect(html).not.toContain('float:right')
    }
    expect(buildPrepackLabelHTML('X', 'B', 'E', SETTINGS)).toBe(buildPrepackLabelHTML('X', 'B', 'E', SETTINGS, null))
  })

  it('carries the symbol bottom-right and reserves that corner so text wraps around it', () => {
    const symbol = symbolFor()
    for (const html of [
      buildPrepackLabelHTML('PARACETAMOL TABLET 500MG', 'PP-26101901', '19 APR 2027', SETTINGS, symbol),
      buildExtempLabelHTML('FLECAINIDE', 'PP-26101901', '19 APR 2027', 'Refrigerate', 'Shake well', '', SETTINGS, symbol),
    ]) {
      expect(html).toContain(dataMatrixSvg(symbol.matrix))
      expect(html).toContain(`left:${symbol.placement.xMm}mm;top:${symbol.placement.yMm}mm;`)
      expect(html).toMatch(/float:right;width:0;height:[\d.]+mm;/)
      expect(html).toMatch(/float:right;clear:right;width:[\d.]+mm;height:[\d.]+mm;/)
      // Label text is still all there.
      expect(html).toContain('PP-26101901')
      expect(html).toContain('19 APR 2027')
    }
  })
})

describe('Drug Reconstitution label', () => {
  it('HTML: symbol in the lower half; Use Before text kept clear of it', () => {
    const symbol = symbolFor('lower-half')
    const html = buildReconstitutionLabelHTML('PP-26101901', '19 APR 2027', SETTINGS, 'AUGM06', symbol)
    expect(html).toContain(dataMatrixSvg(symbol.matrix))
    const reserve = Number((34.4 - symbol.placement.xMm + 0.4).toFixed(3))
    expect(html).toContain(`padding-right:${reserve}mm;`)
    expect(symbol.placement.yMm).toBeGreaterThanOrEqual(12.5)
    // Without a symbol the label is as before.
    expect(buildReconstitutionLabelHTML('PP-26101901', '19 APR 2027', SETTINGS, 'AUGM06')).not.toContain('<svg')
  })

  describe('silent print', () => {
    beforeEach(() => {
      invoke.mockReset()
      vi.stubGlobal('window', { __TAURI_INTERNALS__: {}, dispatchEvent: () => {} })
      vi.stubGlobal('CustomEvent', class { constructor(type, init) { this.type = type; this.detail = init && init.detail } })
    })
    afterEach(() => vi.unstubAllGlobals())

    const flush = () => new Promise(resolve => setTimeout(resolve, 0))

    it('native GDI path receives the module rows, position and module size', async () => {
      invoke.mockResolvedValue(undefined)
      const symbol = symbolFor('lower-half')
      printReconstitutionLabel('PP-26101901', '19 APR 2027', 1, SETTINGS, 'PARA01', symbol)
      await flush()
      expect(invoke).toHaveBeenCalledTimes(1)
      const [command, args] = invoke.mock.calls[0]
      expect(command).toBe('print_reconstitution_label_powershell')
      expect(args).toMatchObject({
        batchNo: 'PP-26101901',
        expiry: '19 APR 2027',
        symbolRows: symbol.matrix.modules,
        symbolXMm: symbol.placement.xMm,
        symbolYMm: symbol.placement.yMm,
        symbolModuleMm: MODULE_MM,
        symbolQuietModules: QUIET_ZONE_MODULES,
      })
    })

    it('HTML fallback (when the native print fails) carries the same symbol', async () => {
      invoke.mockRejectedValueOnce('GDI failed').mockResolvedValue(undefined)
      const symbol = symbolFor('lower-half')
      printReconstitutionLabel('PP-26101901', '19 APR 2027', 1, SETTINGS, 'PARA01', symbol)
      await flush(); await flush()
      expect(invoke.mock.calls.map(c => c[0])).toEqual(['print_reconstitution_label_powershell', 'print_label_html'])
      expect(invoke.mock.calls[1][1].html).toContain(dataMatrixSvg(symbol.matrix))
    })

    it('sends no symbol when there is none', async () => {
      invoke.mockResolvedValue(undefined)
      printReconstitutionLabel('PP-26101901', '19 APR 2027', 1, SETTINGS, 'PARA01')
      await flush()
      expect(invoke.mock.calls[0][1]).toMatchObject({ symbolRows: null, symbolXMm: null })
    })
  })
})
