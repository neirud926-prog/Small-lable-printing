import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PrintPickList from './PrintPickList'
import PrintGtinLabel from './PrintGtinLabel'

export default function EV54Tools({ navigate }) {
  const [tab, setTab] = useState('picklist')

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-back" onClick={() => navigate('menu')}>‹</button>
        <h1>EV54 Tools</h1>
      </div>

      <div className="page-body">
        <div className="tabs mb-12">
          <button
            className={`tab-btn ${tab === 'picklist' ? 'active' : ''}`}
            onClick={() => setTab('picklist')}
          >
            📋 Print EV54 Pick List
          </button>
          <button
            className={`tab-btn ${tab === 'gtinlabel' ? 'active' : ''}`}
            onClick={() => setTab('gtinlabel')}
          >
            🏷 Print GTIN Label
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {tab === 'picklist'  && <PrintPickList />}
            {tab === 'gtinlabel' && <PrintGtinLabel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
