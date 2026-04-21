import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AbxTab from './AbxTab'
import ExtempTab from './ExtempTab'
import PrepackTab from './PrepackTab'
import { getSettings } from '../../utils/storage'

export default function Reconstitution() {
  const s = getSettings()
  const TABS = [
    { id: 'abx',    label: 'ABX Preparation', Component: AbxTab,     enabled: s.enableAbxTab     !== false },
    { id: 'extemp', label: 'Extemporaneous',  Component: ExtempTab,  enabled: s.enableExtempTab  !== false },
    { id: 'prepack', label: 'Prepack',         Component: PrepackTab, enabled: s.enablePrepackTab !== false },
  ].filter(t => t.enabled)

  const [tab, setTab] = useState(TABS[0]?.id || 'abx')

  useEffect(() => {
    if (!TABS.find(t => t.id === tab)) setTab(TABS[0]?.id || 'abx')
  }, [])

  if (TABS.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        All Reconstitution tabs are disabled. Enable them in Settings → Admin.
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
        >
          {ActiveComponent && <ActiveComponent />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
