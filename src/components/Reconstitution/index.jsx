import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getSettings } from '../../utils/storage'
import AbxTab from './AbxTab'
import ExtempTab from './ExtempTab'
import PrepackTab from './PrepackTab'

const ALL_TABS = [
  { id: 'abx',     label: 'ABX Preparation', flag: 'enableAbxTab',     Component: AbxTab },
  { id: 'extemp',  label: 'Extemporaneous',  flag: 'enableExtempTab',  Component: ExtempTab },
  { id: 'prepack', label: 'Prepack',         flag: 'enablePrepackTab', Component: PrepackTab },
]

export default function Reconstitution() {
  const settings = getSettings()
  const visibleTabs = ALL_TABS.filter(t => settings[t.flag] !== false)
  const [tab, setTab] = useState(visibleTabs[0]?.id || 'abx')

  // If the saved active tab was disabled, fall back to the first visible tab.
  useEffect(() => {
    if (!visibleTabs.find(t => t.id === tab)) {
      setTab(visibleTabs[0]?.id || 'abx')
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
        >
          {Active ? <Active /> : (
            <div className="card" style={{ color: 'var(--text-muted)' }}>
              All Reconstitution tabs are disabled. Enable at least one in Settings → Admin.
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
