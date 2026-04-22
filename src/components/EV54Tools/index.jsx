import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PrintPickList from './PrintPickList'
import PrintGtinLabel from './PrintGtinLabel'
import { useApp } from '../../utils/AppContext'

export default function EV54Tools() {
  const { effectiveFlags } = useApp()
  const TABS = [
    { id: 'picklist',  label: 'Print EV54 Pick List', Component: PrintPickList,  enabled: effectiveFlags.enablePickListTab  === true },
    { id: 'gtinlabel', label: 'Print GTIN Label',     Component: PrintGtinLabel, enabled: effectiveFlags.enableGtinLabelTab === true },
  ].filter(t => t.enabled)

  const [tab, setTab] = useState(TABS[0]?.id || 'picklist')

  useEffect(() => {
    if (!TABS.find(t => t.id === tab)) setTab(TABS[0]?.id || 'picklist')
  }, [])

  if (TABS.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        All EV54 Tools tabs are disabled. Enable them in Settings → Admin.
      </div>
    )
  }

  const ActiveComponent = TABS.find(t => t.id === tab)?.Component

  return (
    <div>
      <div className="tabs mb-12" style={{ display: 'inline-flex', width: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
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
          {ActiveComponent && <ActiveComponent />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
