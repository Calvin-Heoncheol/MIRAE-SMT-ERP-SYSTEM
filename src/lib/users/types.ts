import type { AuthDepartment, AuthRole } from '@/lib/auth/types'

export type ErpUserRow = {
  id: string
  email: string
  displayName: string
  role: AuthRole
  department: AuthDepartment | null
  createdAt: string
}

export type CreateErpUserInput = {
  email: string
  password: string
  displayName: string
  role: AuthRole
  department: AuthDepartment | null
}

export type UpdateErpUserInput = {
  id: string
  displayName: string
  role: AuthRole
  department: AuthDepartment | null
  /** 비우면 비밀번호 변경 안 함 */
  password?: string
}
