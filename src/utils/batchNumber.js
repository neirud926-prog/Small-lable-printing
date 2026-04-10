import { getCounter, incrementCounter } from './storage'

// Format today as YYMMDD
export function todayYYMMDD() {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

// Generate batch number: [PREFIX-]YYMMDD[0]N
export function generateBatchNo(location, prefix, usePrefix) {
  const counter = getCounter(location)
  const dateStr = todayYYMMDD()
  const counterStr = counter < 10 ? `0${counter}` : String(counter)
  if (usePrefix && prefix) {
    return `${prefix}-${dateStr}${counterStr}`
  }
  return `${dateStr}${counterStr}`
}

// Calculate expiry date from a rule
export function calcExpiryDate(shelfLifeValue, shelfLifeUnit) {
  const today = new Date()
  if (shelfLifeUnit === 'Days') {
    today.setDate(today.getDate() + parseInt(shelfLifeValue, 10))
  } else if (shelfLifeUnit === 'Month') {
    today.setMonth(today.getMonth() + parseInt(shelfLifeValue, 10))
  }
  return today
}

// Format date as "D MMM YYYY" uppercase (e.g. "5 JAN 2025")
export function formatDateLabel(date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).toUpperCase()
}

// Commit the batch: increment counter after confirmed print
export function commitBatchNo(location) {
  incrementCounter(location)
}
