import React, { useState } from 'react'
import Icon from './Icon'
import logo from '../assets/logo-nlth.jpg'
import { useApp } from '../utils/AppContext'
import UnlockDialog from './UnlockDialog'

const ALL_NAV = [
  { id: 'enquiry',       label: 'Drug Enquiry',      icon: 'search',     badge: '⌘K' },
  { section: 'Work' },
  { id: 'smalllabel',    label: 'Small Label Print', icon: 'tag',        badge: 'F1', flag: 'enableSmallLabel' },
  { id: 'reconstitution',label: 'Reconstitution',    icon: 'pill',       badge: 'F2', flag: 'enableReconstitution' },
  { id: 'ev54tools',     label: 'EV54 Tools',        icon: 'bot',        badge: 'F3', flag: 'enableEV54Tools' },
  { section: 'Data' },
  { id: 'maintenance',   label: 'Maintenance',       icon: 'wrench',     flag: 'enableMaintenance' },
  { section: 'System' },
  { id: 'settings',      label: 'Settings',          icon: 'settings-2', flag: 'enableSettings' },
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
  const { effectiveFlags, sessionUnlocked, computerName, unlock, lock } = useApp()
  const [unlockOpen, setUnlockOpen] = useState(false)

  const visibleNav = ALL_NAV.filter(n => !n.flag || effectiveFlags[n.flag] === true)

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
          {sessionUnlocked ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={lock}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}
              title="Re-lock and reset to this PC's profile"
              aria-label="Lock session"
            >
              <Icon name="lock" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setUnlockOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}
              title="Unlock all functions for this session (admin)"
              aria-label="Admin unlock"
            >
              <Icon name="unlock" size={16} />
            </button>
          )}
          <div className="rail-foot" style={{ marginTop: 8 }}>
            <div className="rail-avatar">RX</div>
            <div className="rail-foot-meta">
              {computerName || 'RxStation'}
              <small>Pharmacy workstation</small>
            </div>
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

        {sessionUnlocked && (
          <div
            style={{
              margin: '0 0 14px 0', padding: '10px 14px',
              background: 'var(--danger-bg, #fde4e4)', color: 'var(--danger, #b91c1c)',
              border: '1px solid var(--danger, #b91c1c)', borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <span>⚠️</span>
            <span>
              Developer unlock active on <code>{computerName || 'this PC'}</code> —
              please do not import any data from this PC.
            </span>
          </div>
        )}

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

      <UnlockDialog open={unlockOpen} onClose={() => setUnlockOpen(false)} onUnlock={unlock} />
    </div>
  )
}
