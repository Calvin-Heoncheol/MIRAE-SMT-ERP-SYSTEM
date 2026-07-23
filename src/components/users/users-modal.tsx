'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import {
  AUTH_DEPARTMENTS,
  AUTH_ROLES,
  formatAuthDepartmentLabel,
  formatAuthRoleLabel,
  type AuthDepartment,
  type AuthRole,
} from '@/lib/auth/types'
import { createErpUser, deleteErpUser, updateErpUser } from '@/lib/users/actions'
import type { ErpUserRow } from '@/lib/users/types'
import { DEFAULT_INITIAL_PASSWORD } from '@/lib/auth/config'

type UsersModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  user?: ErpUserRow | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

type FormState = {
  email: string
  password: string
  displayName: string
  role: AuthRole
  department: AuthDepartment | ''
}

function emptyForm(): FormState {
  return {
    email: '',
    password: DEFAULT_INITIAL_PASSWORD,
    displayName: '',
    role: 'operator',
    department: '',
  }
}

function userToForm(user: ErpUserRow): FormState {
  return {
    email: user.email,
    password: '',
    displayName: user.displayName,
    role: user.role,
    department: user.department || '',
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

export function UsersModal({
  open,
  mode,
  user,
  onClose,
  onSaved,
  onDeleted,
}: UsersModalProps) {
  if (!open) return null

  return (
    <UsersModalContent
      open={open}
      mode={mode}
      user={user}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  )
}

function UsersModalContent({
  mode,
  user,
  onClose,
  onSaved,
  onDeleted,
}: UsersModalProps) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<FormState>(() =>
    user ? userToForm(user) : emptyForm(),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setForm(user ? userToForm(user) : emptyForm())
    setSaveError(null)
  }, [user, mode])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    if (!form.department) {
      setSaveError('부서를 선택해 주세요.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const department = form.department
    const result = isCreate
      ? await createErpUser({
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          role: form.role,
          department,
        })
      : await updateErpUser({
          id: user!.id,
          displayName: form.displayName,
          role: form.role,
          department,
          password: form.password.trim() || undefined,
        })

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!user) return
    if (
      !window.confirm(
        `${user.displayName || user.email} 계정을 삭제하시겠습니까?\n로그인할 수 없게 됩니다.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setSaveError(null)
    const result = await deleteErpUser(user.id)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  const busy = saving || deleting

  return (
    <ErpModal
      open
      size="form"
      title={isCreate ? '사용자 등록' : '사용자 수정'}
      description={
        isCreate
          ? `초기 비밀번호는 ${DEFAULT_INITIAL_PASSWORD} 입니다. 첫 로그인 시 새 비밀번호로 변경하게 됩니다.`
          : '이름·역할·부서를 수정합니다. 비밀번호를 바꾸면 다음 로그인 시 변경을 다시 요청합니다.'
      }
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {!isCreate ? (
            <ErpButton type="button" variant="danger" disabled={busy} onClick={() => void handleDelete()}>
              {deleting ? '삭제 중…' : '삭제'}
            </ErpButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <ErpButton type="button" variant="secondary" disabled={busy} onClick={onClose}>
              취소
            </ErpButton>
            <ErpButton type="button" disabled={busy} onClick={() => void handleSave()}>
              {saving ? '저장 중…' : '저장'}
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="이름">
          <input
            className={inputClass}
            value={form.displayName}
            onChange={(e) => updateForm('displayName', e.target.value)}
            placeholder="홍길동"
            disabled={busy}
            autoComplete="off"
          />
        </Field>

        <Field label="이메일">
          <input
            className={inputClass}
            type="email"
            value={form.email}
            onChange={(e) => updateForm('email', e.target.value)}
            placeholder="user@example.com"
            disabled={busy || !isCreate}
            autoComplete="off"
          />
        </Field>

        <Field label={isCreate ? '초기 비밀번호' : '비밀번호 변경 (선택)'}>
          <input
            className={inputClass}
            type="password"
            value={form.password}
            onChange={(e) => updateForm('password', e.target.value)}
            placeholder={isCreate ? DEFAULT_INITIAL_PASSWORD : '변경 시에만 입력'}
            disabled={busy}
            autoComplete="new-password"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="역할">
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => updateForm('role', e.target.value as AuthRole)}
              disabled={busy}
            >
              {AUTH_ROLES.map((role) => (
                <option key={role} value={role}>
                  {formatAuthRoleLabel(role)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="부서">
            <select
              className={inputClass}
              value={form.department}
              onChange={(e) =>
                updateForm('department', e.target.value as AuthDepartment | '')
              }
              disabled={busy}
              required
            >
              <option value="" disabled>
                부서 선택
              </option>
              {AUTH_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {formatAuthDepartmentLabel(department)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {saveError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {saveError}
          </p>
        ) : null}
      </div>
    </ErpModal>
  )
}
