import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  saveDrugs, getDrugs, saveExpiryRules, getExpiryRules,
  saveAbxList, getAbxList, savePrepackList, getPrepackList,
  saveExtempList, getExtempList, saveExpAfterOpen, getExpAfterOpen,
} from '../../utils/storage'
import {
  parseExcelFile, extractDrugs, extractExpiryRules, extractAbx,
  extractPrepack, extractExtemp, extractExpAfterOpen,
} from '../../utils/excelImporter'

const IMPORT_MODES = [
  { key: 'drugs', label: 'Drugs (PHQ)', icon: '💊' },
  { key: 'expiry', label: 'Expiry Rules', icon: '📅' },
  { key: 'abx', label: 'ABX', icon: '⚕️' },
  { key: 'prepack', label: 'Prepack', icon: '📦' },
  { key: 'extemp', label: 'Extemp', icon: '⚗️' },
  { key: 'expAfterOpen', label: 'Exp After Open', icon: '⏰' },
]

export default function ExcelImporter() {
  const [mode, setMode] = useState('drugs')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState('')
  const [step, setStep] = useState('select') // select, preview, confirm, done

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setMessage('')
    setFile(selectedFile)

    try {
      const sheets = await parseExcelFile(selectedFile)
      const sheetNames = Object.keys(sheets)

      if (sheetNames.length === 0) {
        setMessage('✗ No data found in Excel file')
        return
      }

      // Auto-detect the best sheet or use first sheet
      const sheetData = sheets[sheetNames[0]]

      // Extract data based on mode
      let extractedData = []
      switch (mode) {
        case 'drugs':
          extractedData = extractDrugs(sheetData)
          break
        case 'expiry':
          extractedData = extractExpiryRules(sheetData)
          break
        case 'abx':
          extractedData = extractAbx(sheetData)
          break
        case 'prepack':
          extractedData = extractPrepack(sheetData)
          break
        case 'extemp':
          extractedData = extractExtemp(sheetData)
          break
        case 'expAfterOpen':
          extractedData = extractExpAfterOpen(sheetData)
          break
        default:
          break
      }

      if (extractedData.length === 0) {
        setMessage('✗ No valid data found for selected type')
        return
      }

      setPreview({ data: extractedData, sheetName: sheetNames[0], count: extractedData.length })
      setStep('preview')
    } catch (err) {
      setMessage(`✗ Error: ${err.message}`)
    }
  }

  const handleImport = (replaceAll = false) => {
    if (!preview) return

    try {
      let existing = []
      switch (mode) {
        case 'drugs':
          existing = getDrugs()
          saveDrugs(replaceAll ? preview.data : [...existing, ...preview.data])
          break
        case 'expiry':
          existing = getExpiryRules()
          saveExpiryRules(replaceAll ? preview.data : [...existing, ...preview.data])
          break
        case 'abx':
          existing = getAbxList()
          saveAbxList(replaceAll ? preview.data : [...existing, ...preview.data])
          break
        case 'prepack':
          existing = getPrepackList()
          savePrepackList(replaceAll ? preview.data : [...existing, ...preview.data])
          break
        case 'extemp':
          existing = getExtempList()
          saveExtempList(replaceAll ? preview.data : [...existing, ...preview.data])
          break
        case 'expAfterOpen':
          existing = getExpAfterOpen()
          saveExpAfterOpen(replaceAll ? preview.data : [...existing, ...preview.data])
          break
        default:
          break
      }

      setMessage(
        `✓ Successfully imported ${preview.count} ${mode} records. ${replaceAll ? '(Replaced all)' : '(Merged with existing)'}`
      )
      setStep('done')
      setTimeout(() => {
        setFile(null)
        setPreview(null)
        setStep('select')
        setMessage('')
      }, 3000)
    } catch (err) {
      setMessage(`✗ Import failed: ${err.message}`)
    }
  }

  const currentMode = IMPORT_MODES.find(m => m.key === mode)

  return (
    <div>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📊 Import from Excel</div>

        {step === 'select' && (
          <div>
            <div className="form-group">
              <label className="form-label">Select Data Type to Import</label>
              <div className="section-toggle-group" style={{ flexWrap: 'wrap' }}>
                {IMPORT_MODES.map(m => (
                  <button
                    key={m.key}
                    className={`section-toggle ${mode === m.key ? 'active' : ''}`}
                    onClick={() => { setMode(m.key); setMessage(''); setFile(null); setPreview(null) }}
                    style={{ fontSize: 12 }}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Excel File (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px',
                  border: '2px dashed var(--primary)',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg)',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                File name: {file ? file.name : 'No file selected'}
              </div>
            </div>

            <div className="card" style={{ backgroundColor: 'var(--bg)', borderLeft: '4px solid var(--info)' }}>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                <strong>Expected columns for {currentMode.label}:</strong>
                {mode === 'drugs' && (
                  <div>itemCode, name, unit, isSpecial (yes/no)</div>
                )}
                {mode === 'expiry' && (
                  <div>itemCode, manufacturer, shelfLifeValue, shelfLifeUnit (Days/Month), storage, warning, status (Active/Suspended), note</div>
                )}
                {mode === 'abx' && (
                  <div>itemCode, prefix, packSize, description</div>
                )}
                {mode === 'prepack' && (
                  <div>drugCode, prefix, description, unit</div>
                )}
                {mode === 'extemp' && (
                  <div>itemCode, prefix, volume, description</div>
                )}
                {mode === 'expAfterOpen' && (
                  <div>itemCode, days</div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ backgroundColor: 'var(--bg)', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📋 Preview</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Sheet: <strong>{preview.sheetName}</strong> | Found: <strong>{preview.count}</strong> records
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <tbody>
                    {preview.data.slice(0, 5).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 6 }}>
                          {Object.values(row).slice(0, 3).join(' | ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.count > 5 && (
                  <div style={{ padding: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    ... and {preview.count - 5} more records
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => { setStep('select'); setFile(null); setPreview(null) }}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={() => handleImport(false)}>
                ✓ Merge with Existing
              </button>
              <button className="btn btn-warning" onClick={() => handleImport(true)}>
                ⚠️ Replace All
              </button>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                backgroundColor: message.startsWith('✓') ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                color: message.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                borderLeft: `4px solid ${message.startsWith('✓') ? 'var(--success)' : 'var(--danger)'}`,
              }}
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
