import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauriStorage'
import { getProfileForComputer, allFlagsTrue } from './storage'

const AppContext = createContext({
  computerName: '',
  sessionUnlocked: false,
  effectiveFlags: {},
  unlock: () => {},
  lock: () => {},
  refreshFlags: () => {},
})

export function AppProvider({ children }) {
  const [computerName, setComputerName]       = useState('')
  const [sessionUnlocked, setSessionUnlocked] = useState(false)
  const [profileVersion, setProfileVersion]   = useState(0)

  // Fetch COMPUTERNAME once at startup (Tauri only).
  useEffect(() => {
    let cancelled = false
    async function fetchName() {
      if (!isTauri()) return
      try {
        const name = await invoke('get_computer_name')
        if (!cancelled) setComputerName((name || '').toString())
      } catch (e) {
        console.warn('get_computer_name failed:', e)
      }
    }
    fetchName()
    return () => { cancelled = true }
  }, [])

  const profile = getProfileForComputer(computerName)
  const effectiveFlags = sessionUnlocked ? allFlagsTrue() : profile

  const unlock = useCallback(() => setSessionUnlocked(true), [])
  const lock   = useCallback(() => setSessionUnlocked(false), [])
  const refreshFlags = useCallback(() => setProfileVersion(v => v + 1), [])

  // profileVersion is included so that consumers re-render when profiles are saved.
  // eslint-disable-next-line no-unused-vars
  const _v = profileVersion

  return (
    <AppContext.Provider value={{
      computerName, sessionUnlocked, effectiveFlags, unlock, lock, refreshFlags,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
