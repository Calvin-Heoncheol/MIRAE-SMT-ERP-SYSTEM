'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type DashboardChromeContextValue = {
  /** true면 사이드 네비·위치 헤더를 숨기고 본문만 넓게 표시 */
  focusMode: boolean
  setFocusMode: (value: boolean) => void
  toggleFocusMode: () => void
}

const DashboardChromeContext = createContext<DashboardChromeContextValue | null>(null)

export function DashboardChromeProvider({ children }: { children: ReactNode }) {
  const [focusMode, setFocusModeState] = useState(false)

  const setFocusMode = useCallback((value: boolean) => {
    setFocusModeState(value)
  }, [])

  const toggleFocusMode = useCallback(() => {
    setFocusModeState((current) => !current)
  }, [])

  useEffect(() => {
    if (!focusMode) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFocusModeState(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusMode])

  const value = useMemo(
    () => ({ focusMode, setFocusMode, toggleFocusMode }),
    [focusMode, setFocusMode, toggleFocusMode],
  )

  return (
    <DashboardChromeContext.Provider value={value}>{children}</DashboardChromeContext.Provider>
  )
}

export function useDashboardChrome() {
  return (
    useContext(DashboardChromeContext) ?? {
      focusMode: false,
      setFocusMode: () => {},
      toggleFocusMode: () => {},
    }
  )
}
