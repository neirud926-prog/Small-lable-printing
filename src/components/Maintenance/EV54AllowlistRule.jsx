import React, { useState } from 'react'
import { getSettings, saveSettings, getEV54Drugs } from '../../utils/storage'

export default function EV54AllowlistRule() {
  const [settings, setSettings] = useState(getSettings)
  const [saved, setSaved]       = useState(false)
  const ev54Count = getEV54Drugs().length

  const toggle = (checked) => {
    const next = { ...settings, restrictToEV54List: checked }
    setSettings(next)
    saveSettings({ restrictToEV54List: checked })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const on = !!settings.restrictToEV54List

  return (
    <div>
      <div className="card" style={{ borderLeft: `4px solid ${on ? 'var(--success)' : 'var(--warning)'}` }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
          🤖 EV54 Pick List Allowlist
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={on}
            onChange={e => toggle(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Restrict pick list to EV54 Drugs only
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
              When <strong>ON</strong>, the EV54 pick list will reject any item code that is
              not in the EV54 Drugs table. This prevents staff from accidentally picking
              drugs that the EV54 machine does not stock.
              <br /><br />
              Currently defaults to <strong>OFF</strong> because the EV54 Drugs data is still
              being prepared. Turn this on once the list is loaded and verified.
            </div>
          </div>
        </label>

        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 13 }}>
          <strong>EV54 Drugs loaded:</strong>{' '}
          <span style={{ color: ev54Count > 0 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
            {ev54Count} {ev54Count === 1 ? 'drug' : 'drugs'}
          </span>
          {ev54Count === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Load EV54 Drugs via Settings → Data Sources → EV54 Drugs, or Maintenance → Data → Import Excel.
            </div>
          )}
        </div>

        {saved && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)' }}>
            ✓ Rule updated
          </div>
        )}
      </div>
    </div>
  )
}
