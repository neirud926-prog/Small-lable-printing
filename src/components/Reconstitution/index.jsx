import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AbxTab from './AbxTab'
import ExtempTab from './ExtempTab'
import PrepackTab from './PrepackTab'

export default function Reconstitution() {
  const [tab, setTab] = useState('abx')

  return (
    <div>
      <div className="tabs mb-12" style={{ display: 'inline-flex', width: 'auto' }}>
        <button className={`tab-btn ${tab === 'abx' ? 'active' : ''}`} onClick={() => setTab('abx')}>
          ABX Preparation
        </button>
        <button className={`tab-btn ${tab === 'extemp' ? 'active' : ''}`} onClick={() => setTab('extemp')}>
          Extemporaneous
        </button>
        <button className={`tab-btn ${tab === 'prepack' ? 'active' : ''}`} onClick={() => setTab('prepack')}>
          Prepack
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
        >
          {tab === 'abx'    && <AbxTab />}
          {tab === 'extemp' && <ExtempTab />}
          {tab === 'prepack' && <PrepackTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
