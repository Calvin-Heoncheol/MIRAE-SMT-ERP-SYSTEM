'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type BusyContextValue = {
  busyCount: number
  isBusy: boolean
  begin: () => void
  end: () => void
  /** 비동기 작업 동안 상단 로딩바 표시 */
  run: <T>(task: () => Promise<T>) => Promise<T>
}

const BusyContext = createContext<BusyContextValue | null>(null)

export function BusyProvider({ children }: { children: ReactNode }) {
  const [busyCount, setBusyCount] = useState(0)

  const begin = useCallback(() => {
    setBusyCount((count) => count + 1)
  }, [])

  const end = useCallback(() => {
    setBusyCount((count) => Math.max(0, count - 1))
  }, [])

  const run = useCallback(
    async <T,>(task: () => Promise<T>) => {
      begin()
      try {
        return await task()
      } finally {
        end()
      }
    },
    [begin, end],
  )

  const value = useMemo(
    () => ({
      busyCount,
      isBusy: busyCount > 0,
      begin,
      end,
      run,
    }),
    [busyCount, begin, end, run],
  )

  return (
    <BusyContext.Provider value={value}>
      {children}
      {busyCount > 0 ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[210] h-0.5 overflow-hidden bg-slate-200/50"
          role="progressbar"
          aria-label="처리 중"
          aria-busy="true"
        >
          <div className="erp-busy-bar h-full w-1/3 bg-emerald-500" />
        </div>
      ) : null}
    </BusyContext.Provider>
  )
}

export function useBusy() {
  const context = useContext(BusyContext)
  if (!context) {
    throw new Error('useBusy must be used within BusyProvider')
  }
  return context
}
