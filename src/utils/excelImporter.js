// Excel file parser for importing Products and Expiry Rules
// Supports .xlsx files using built-in browser APIs via SheetJS library fallback

// Parse Excel file and extract sheets
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // Use dynamic import or fallback
        importExcelLib()
          .then(XLSX => {
            const data = new Uint8Array(e.target.result)
            const workbook = XLSX.read(data, { type: 'array' })
            const sheets = {}
            workbook.SheetNames.forEach(name => {
              sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name])
            })
            resolve(sheets)
          })
          .catch(err => {
            // Fallback: manual parsing
            console.warn('SheetJS not available, attempting basic parsing', err)
            reject(new Error('Excel parsing library not available. Please install SheetJS or use CSV format.'))
          })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

// Dynamic import of SheetJS
function importExcelLib() {
  // Check if XLSX is already loaded globally
  if (typeof window !== 'undefined' && window.XLSX) {
    return Promise.resolve(window.XLSX)
  }

  // Try to load from CDN
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js'
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX)
      } else {
        reject(new Error('XLSX library failed to load'))
      }
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// Extract drugs/products from sheet data
export function extractDrugs(data) {
  // Expected columns: itemCode, name, unit, isSpecial
  return data
    .filter(row => row.itemCode && row.itemCode.trim())
    .map(row => ({
      id: Date.now().toString() + Math.random(),
      itemCode: (row.itemCode || '').toString().trim().toUpperCase(),
      name: (row.name || row['Drug Name'] || '').toString().trim(),
      unit: (row.unit || row['Unit'] || '').toString().trim(),
      isSpecial: ['yes', 'true', '1', 'y'].includes((row.isSpecial || '').toString().toLowerCase()),
    }))
}

// Extract expiry rules from sheet data
export function extractExpiryRules(data) {
  // Expected columns: itemCode, manufacturer, shelfLifeValue, shelfLifeUnit, storage, warning, status, note
  return data
    .filter(row => row.itemCode && row.manufacturer && row.itemCode.trim())
    .map(row => ({
      id: Date.now().toString() + Math.random(),
      itemCode: (row.itemCode || '').toString().trim().toUpperCase(),
      manufacturer: (row.manufacturer || '').toString().trim(),
      shelfLifeValue: parseInt(row.shelfLifeValue || row['Shelf Life Value'] || 0, 10) || '',
      shelfLifeUnit: (row.shelfLifeUnit || row['Shelf Life Unit'] || 'Days').toString().trim(),
      storage: (row.storage || row['Storage'] || '').toString().trim(),
      warning: (row.warning || row['Warning'] || '').toString().trim(),
      note: (row.note || row['Note'] || '').toString().trim(),
      status: (row.status || row['Status'] || 'Active').toString().trim(),
    }))
}

// Extract ABX products from sheet data
export function extractAbx(data) {
  // Expected columns: itemCode, prefix, packSize, description
  return data
    .filter(row => row.itemCode && row.itemCode.trim())
    .map(row => ({
      id: Date.now().toString() + Math.random(),
      itemCode: (row.itemCode || '').toString().trim().toUpperCase(),
      prefix: (row.prefix || '').toString().trim(),
      packSize: (row.packSize || row['Pack Size'] || '').toString().trim(),
      description: (row.description || row['Description'] || '').toString().trim(),
    }))
}

// Extract Prepack from sheet data
export function extractPrepack(data) {
  // Expected columns: drugCode, prefix, description, unit
  return data
    .filter(row => row.drugCode && row.drugCode.trim())
    .map(row => ({
      id: Date.now().toString() + Math.random(),
      drugCode: (row.drugCode || '').toString().trim().toUpperCase(),
      prefix: (row.prefix || '').toString().trim(),
      description: (row.description || row['Description'] || '').toString().trim(),
      unit: (row.unit || row['Unit'] || '').toString().trim(),
    }))
}

// Extract Extemp from sheet data
export function extractExtemp(data) {
  // Expected columns: itemCode, prefix, volume, description
  return data
    .filter(row => row.itemCode && row.itemCode.trim())
    .map(row => ({
      id: Date.now().toString() + Math.random(),
      itemCode: (row.itemCode || '').toString().trim().toUpperCase(),
      prefix: (row.prefix || '').toString().trim(),
      volume: (row.volume || '').toString().trim(),
      description: (row.description || row['Description'] || '').toString().trim(),
    }))
}

// Extract Exp After Open from sheet data
export function extractExpAfterOpen(data) {
  // Expected columns: itemCode, days
  return data
    .filter(row => row.itemCode && row.itemCode.trim())
    .map(row => ({
      id: Date.now().toString() + Math.random(),
      itemCode: (row.itemCode || '').toString().trim().toUpperCase(),
      days: parseInt(row.days || row['Days'] || 0, 10) || '',
    }))
}
