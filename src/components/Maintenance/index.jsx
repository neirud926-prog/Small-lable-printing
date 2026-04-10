import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettings } from '../../utils/storage'
import ProductManager from './ProductManager'
import ExpiryRules from './ExpiryRules'
import BatchHistory from './BatchHistory'
import CancelBatch from './CancelBatch'
import ExcelImporter from './ExcelImporter'

export default function Maintenance({ navigate }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState(false)
  const [tab, setTab]           = useState('products')

  const handlePinSubmit = (e) => {
    e.preventDefault()
    const settings = getSettings()
    if (pin === settings.maintenancePin) {
      setUnlocked(true)
      setPinError(false)
    } else {
      setPinError(true)
      setPin('')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-back" onClick={() => navigate('menu')}>‹</button>
        <h1>Maintenance {unlocked && <span style={{ fontSize: 12, color: 'var(--success)', marginLeft: 8 }}>🔓 Unlocked</span>}</h1>
      </div>

      {!unlocked ? (
        <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card"
            style={{ maxWidth: 340, width: '100%', textAlign: 'center' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Maintenance Area</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Enter your PIN to access product data and settings.
            </div>
            <form onSubmit={handlePinSubmit}>
              <input
                className="form-input"
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                autoFocus
                style={{ textAlign: 'center', letterSpacing: 4, fontSize: 18, marginBottom: 12 }}
              />
              <AnimatePresence>
                {pinError && (
                  <motion.div
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: [0, -10, 10, -10, 10, 0] }}
                    exit={{ opacity: 0 }}
                    style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}
                  >
                    Incorrect PIN. Please try again.
                  </motion.div>
                )}
              </AnimatePresence>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Unlock</button>
            </form>
          </motion.div>
        </div>
      ) : (
        <div className="page-body">
          <div className="tabs mb-12">
            <button className={`tab-btn ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>📦 Products</button>
            <button className={`tab-btn ${tab === 'expiry' ? 'active' : ''}`} onClick={() => setTab('expiry')}>📅 Expiry Rules</button>
            <button className={`tab-btn ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>📊 Import Excel</button>
            <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>📋 Batch History</button>
            <button className={`tab-btn ${tab === 'cancel' ? 'active' : ''}`} onClick={() => setTab('cancel')}>❌ Cancel Batch</button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {tab === 'products' && <ProductManager />}
              {tab === 'expiry'   && <ExpiryRules />}
              {tab === 'import'   && <ExcelImporter />}
              {tab === 'history'  && <BatchHistory />}
              {tab === 'cancel'   && <CancelBatch />}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
