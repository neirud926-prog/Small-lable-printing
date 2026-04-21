import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettings } from '../../utils/storage'
import PrintPickList from './PrintPickList'
import PrintGtinLabel from './PrintGtinLabel'

const ALL_TABS = [
  { id: 'picklist',  label: 'Print EV54 Pick List', flag: 'enablePickListTab',  Component: PrintPickList },
  { id: 'gtinlabel', label: 'Print GTIN Label',     flag: 'enableGtinLabelTab', Component: PrintGtinLabel },
]

export default function EV54Tools() {
  const settings = getSettings()
  const visibleTabs = ALL_TABS.filter(t => settings[t.flag] !== false)
  const [tab, setTab] = useState(visibleTabs[0]?.id || 'picklist')

  useEffect(() => {
    if (!visibleTabs.find(t => t.id === tab)) {
      setTab(visibleTabs[0]?.id || 'picklist')
    }
  }, [tab, visibleTabs])

  const Active = visibleTabs.find(t => t.id === tab)?.Component

  return (
    <div>
      <div className="tabs mb-12" style={{ display: 'inline-flex', width: 'auto' }}>
        {visibleTabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          {Active ? <Active /> : (
            <div className="card" style={{ color: 'var(--text-muted)' }}>
              All EV54 tabs are disabled. Enable at least one in Settings → Admin.
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
