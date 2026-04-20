import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettings } from '../../utils/storage'
import Icon from '../Icon'
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

const SECTIONS = [
  {
    group: 'Products',
    items: [
      { id: 'products', label: 'Products',       icon: 'package',  Component: ProductManager },
      { id: 'expiry',   label: 'Expiry rules',   icon: 'calendar', Component: ExpiryRules },
      { id: 'expopen',  label: 'Exp after open', icon: 'timer',    Component: ExpAfterOpen },
    ],
  },
  {
    group: 'Data',
    items: [
      { id: 'import',      label: 'Import Excel', icon: 'download',    Component: ExcelImporter },
      { id: 'mobileshelf', label: 'Mobile shelf', icon: 'layout-grid', Component: MobileShelfViewer },
      { id: 'ev54drugs',   label: 'EV54 drugs',   icon: 'bot',         Component: EV54DrugsViewer },
      { id: 'gtin',        label: 'GTIN database',icon: 'hash',        Component: GtinViewer },
    ],
  },
  {
    group: 'Batches',
    items: [
      { id: 'history', label: 'Batch history', icon: 'list',      Component: BatchHistory },
      { id: 'cancel',  label: 'Cancel batch',  icon: 'x-circle',  Component: CancelBatch },
    ],
  },
  {
    group: 'Rules',
    items: [
      { id: 'ev54rule', label: 'EV54 allowlist', icon: 'settings-2', Component: EV54AllowlistRule },
    ],
  },
]

const ALL_ITEMS = SECTIONS.flatMap(s => s.items)

export default function Maintenance({ navigate }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState(false)
  const [subTab, setSubTab]     = useState('products')

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

  if (!unlocked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="ds-card"
          style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 12, background: 'var(--primary-50)',
            color: 'var(--primary-700)', marginBottom: 12,
          }}>
            <Icon name="lock" size={22} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Maintenance area</div>
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: [0, -8, 8, -8, 8, 0] }}
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
    )
  }

  const active = ALL_ITEMS.find(it => it.id === subTab) || ALL_ITEMS[0]
  const ActiveComponent = active.Component

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
      <aside className="ds-card" style={{ padding: '12px 8px', height: 'fit-content', position: 'sticky', top: 68 }}>
        {SECTIONS.map(sec => (
          <div key={sec.group} style={{ marginBottom: 10 }}>
            <div style={{
              font: '600 10px var(--font)', color: 'var(--text-subtle)',
              letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 12px',
            }}>{sec.group}</div>
            {sec.items.map(it => (
              <button
                key={it.id}
                onClick={() => setSubTab(it.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 12px', border: 0,
                  background: subTab === it.id ? 'var(--primary-50)' : 'transparent',
                  color:      subTab === it.id ? 'var(--primary-800)' : 'var(--text)',
                  borderRadius: 8, cursor: 'pointer',
                  font: subTab === it.id ? '600 13px var(--font)' : '500 13px var(--font)',
                  textAlign: 'left',
                }}
              >
                <Icon name={it.icon} size={15} />
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {active.id === 'expopen'
              ? <ActiveComponent navigate={navigate} />
              : <ActiveComponent />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
