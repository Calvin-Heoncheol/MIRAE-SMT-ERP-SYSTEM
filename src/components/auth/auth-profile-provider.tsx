'use client'

import { createContext, useContext } from 'react'
import { canDeleteRecords } from '@/lib/auth/write-permissions'
import type { AuthProfile } from '@/lib/auth/types'

type AuthProfileContextValue = {
  profile: AuthProfile | null
  authDisabled: boolean
  canDelete: boolean
}

const AuthProfileContext = createContext<AuthProfileContextValue>({
  profile: null,
  authDisabled: false,
  canDelete: false,
})

export function AuthProfileProvider({
  profile,
  authDisabled = false,
  children,
}: {
  profile: AuthProfile | null
  authDisabled?: boolean
  children: React.ReactNode
}) {
  return (
    <AuthProfileContext.Provider
      value={{
        profile,
        authDisabled,
        canDelete: canDeleteRecords(profile, authDisabled),
      }}
    >
      {children}
    </AuthProfileContext.Provider>
  )
}

export function useAuthProfile() {
  return useContext(AuthProfileContext)
}

export function useCanDeleteRecords() {
  return useContext(AuthProfileContext).canDelete
}
