import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettings } from '../../utils/storage'
import ProductManager from './ProductManager'
import ExpiryRules from './ExpiryRules'
import BatchHistory from './BatchHistory'
import CancelBatch from './CancelBatch'
import ExcelImporter from './ExcelImporter'
import ExpAfterOpen from './ExpAfterOpen'
import GtinViewer from './GtinViewer'
import MobileShelfViewer from './MobileShelfViewer'
import EV54DrugsViewer from './EV54DrugsViewer'
import EV54AllowlistRule from './EV54AllowlistRule'

const GROUPS = {
  products: {
    label: '📦 Products',
    tabs: [
      { id: 'products', label: '📦 Products',      Component: ProductManager },
      { id: 'expiry',   label: '📅 Expiry Rules',  Component: ExpiryRules },
      { id: 'expopen',  label: '⏱ Exp After Open', Component: ExpAfterOpen },
    ],
  },
  data: {
    label: '📊 Data',
    tabs: [
      { id: 'import',      label: '📥 Import Excel', Component: ExcelImporter },
      { id: 'mobileshelf', label: '🟢 Mobile Shelf', Component: MobileShelfViewer },
      { id: 'ev54drugs',   label: '🤖 EV54 Drugs',   Component: EV54DrugsViewer },
      { id: 'gtin',        label: '🔢 GTIN',         Component: GtinViewer },
    ],
  },
  batches: {
    label: '📋 Batches',
    tabs: [
      { id: 'history', label: '📋 Batch History', Component: BatchHistory },
      { id: 'cancel',  label: '❌ Cancel Batch',  Component: CancelBatch },
    ],
  },
  rules: {
    label: '⚙️ Rules',
    tabs: [
      { id: 'ev54rule', label: '🤖 EV54 Allowlist', Component: EV54AllowlistRule },
    ],
  },
}

export default function Maintenance({ navigate }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState(false)
  const [group, setGroup]       = useState('products')
  const [subTab, setSubTab]     = useState(GROUPS.products.tabs[0].id)

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

  const selectGroup = (g) => {
    setGroup(g)
    setSubTab(GROUPS[g].tabs[0].id)
  }

  const activeTabs = GROUPS[group].tabs
  const activeTab  = activeTabs.find(t => t.id === subTab) || activeTabs[0]
  const ActiveComponent = activeTab.Component

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
          {/* Group row */}
          <div className="tabs" style={{ marginBottom: 6 }}>
            {Object.entries(GROUPS).map(([gKey, g]) => (
              <button
                key={gKey}
                className={`tab-btn ${group === gKey ? 'active' : ''}`}
                onClick={() => selectGroup(gKey)}
                style={{ fontWeight: 700 }}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Sub-tab row */}
          <div className="tabs mb-12" style={{ opacity: 0.95 }}>
            {activeTabs.map(t => (
              <button
                key={t.id}
                className={`tab-btn ${subTab === t.id ? 'active' : ''}`}
                onClick={() => setSubTab(t.id)}
                style={{ fontSize: 13 }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${group}:${subTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {activeTab.id === 'expopen'
                ? <ActiveComponent navigate={navigate} />
                : <ActiveComponent />}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
