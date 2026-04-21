import React from 'react'
import Icon from './Icon'
import logo from '../assets/logo-nlth.jpg'
import { getSettings } from '../utils/storage'

// Nav ids whose visibility is controlled by feature flags.
const NAV_FLAG = {
  smalllabel:     'enableSmallLabel',
  reconstitution: 'enableReconstitution',
  ev54tools:      'enableEV54Tools',
}

const NAV = [
  { id: 'enquiry',    label: 'Drug Enquiry',      icon: 'search',     badge: '⌘K' },
  { section: 'Work' },
  { id: 'smalllabel', label: 'Small Label Print', icon: 'tag',        badge: 'F1' },
  { id: 'reconstitution', label: 'Reconstitution',icon: 'pill',       badge: 'F2' },
  { id: 'ev54tools',  label: 'EV54 Tools',        icon: 'bot',        badge: 'F3' },
  { section: 'Data' },
  { id: 'maintenance',label: 'Maintenance',       icon: 'wrench' },
  { section: 'System' },
  { id: 'settings',   label: 'Settings',          icon: 'settings-2' },
]

const CRUMB = {
  enquiry:        ['Lookup',  'Drug Enquiry'],
  smalllabel:     ['Work',    'Small Label Print'],
  reconstitution: ['Work',    'Reconstitution'],
  ev54tools:      ['Work',    'EV54 Tools'],
  maintenance:    ['Data',    'Maintenance'],
  settings:       ['System',  'Settings'],
}

const SUBTITLE = {
  enquiry:        'Quick drug lookup — read-only. For printing, use Small Label Print.',
  smalllabel:     'Scan a barcode or enter a 6-character item code.',
  reconstitution: 'Generate and reprint labels for compounded preparations.',
  ev54tools:      'Refill the EV54 dispensing robot with printed pick-lists.',
  maintenance:    'Product data, expiry rules, and batch history.',
  settings:       'Printer, fonts, data sources, and PIN.',
}

export default function AppShell({ view, onNav, children, onGlobalSearch }) {
  const crumb = CRUMB[view] || CRUMB.enquiry
  const settings = getSettings()

  // Hide nav items whose feature flag is disabled. Always keep section headers
  // for now (visually harmless if a whole section becomes empty).
  const visibleNav = NAV.filter(n => {
    if (n.section) return true
    const flag = NAV_FLAG[n.id]
    return !flag || settings[flag] !== false
  })

  // If the current view was disabled from under us, fall back to Drug Enquiry.
  const flag = NAV_FLAG[view]
  if (flag && settings[flag] === false) {
    // defer to avoid setState-during-render in the parent
    setTimeout(() => onNav('enquiry'), 0)
  }

  return (
    <div className="app-layout">
      <aside className="rail">
        <div className="rail-brand">
          <div className="rail-mark"><img src={logo} alt="NLTH" /></div>
          <div className="rail-word">RxStation <span>· NLTH</span></div>
        </div>
        <nav className="rail-nav">
          {visibleNav.map((n, i) => n.section
            ? <div key={i} className="rail-section">{n.section}</div>
            : (
              <button
                key={n.id}
                type="button"
                className={`rail-item ${view === n.id ? 'active' : ''}`}
                onClick={() => onNav(n.id)}
              >
                <Icon name={n.icon} size={17} />
                <span>{n.label}</span>
                {n.badge && <span className="rail-badge">{n.badge}</span>}
              </button>
            )
          )}
        </nav>
        <div className="rail-foot">
          <div className="rail-avatar">RX</div>
          <div className="rail-foot-meta">
            RxStation
            <small>Pharmacy workstation</small>
          </div>
        </div>
      </aside>

      <main className="shell-main">
        <header className="topbar">
          <div className="crumb">
            <span>{crumb[0]}</span>
            <Icon name="chevron-right" size={13} />
            <b>{crumb[1]}</b>
          </div>
          <div className="topbar-search">
            <Icon name="search" size={14} />
            <input
              placeholder="Search drug, item code, GTIN…"
              onKeyDown={e => {
                if (e.key === 'Enter' && onGlobalSearch) onGlobalSearch(e.currentTarget.value)
              }}
            />
            <kbd>⌘K</kbd>
          </div>
          <div className="top-actions">
            <span className="chip"><span className="dot" />IP/OP</span>
          </div>
        </header>

        <div className="view">
          <div className="view-head">
            <div>
              <div className="view-title">{crumb[1]}</div>
              <div className="view-sub">{SUBTITLE[view] || ''}</div>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
