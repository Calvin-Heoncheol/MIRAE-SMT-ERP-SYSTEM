'use server'

import { getAuthProfile } from '@/lib/auth/session'
import { isAuthDisabled } from '@/lib/auth/config'
import { canPerformDangerousWrite } from '@/lib/auth/write-permissions'
import {
  deleteCompanyNotice,
  upsertCompanyNotice,
  type DeleteNoticeResult,
  type MutateNoticeResult,
} from './repository'
import type { UpsertCompanyNoticeInput } from './types'

async function requireNoticeManager(): Promise<
  | { ok: true; id: string | null; name: string }
  | { ok: false; reason: 'auth'; detail: string }
> {
  if (isAuthDisabled()) {
    return { ok: true, id: null, name: '시스템' }
  }
  const profile = await getAuthProfile()
  if (!profile) return { ok: false, reason: 'auth', detail: '로그인이 필요합니다.' }
  if (!canPerformDangerousWrite(profile.role)) {
    return { ok: false, reason: 'auth', detail: '팀장 이상만 공지를 작성·수정할 수 있습니다.' }
  }
  return { ok: true, id: profile.id, name: profile.displayName }
}

export async function saveCompanyNoticeAction(
  input: UpsertCompanyNoticeInput,
): Promise<MutateNoticeResult | { ok: false; reason: 'auth'; detail: string }> {
  const gate = await requireNoticeManager()
  if (!gate.ok) return gate
  return upsertCompanyNotice(input, { id: gate.id, name: gate.name })
}

export async function deleteCompanyNoticeAction(
  id: string,
): Promise<DeleteNoticeResult | { ok: false; reason: 'auth'; detail: string }> {
  const gate = await requireNoticeManager()
  if (!gate.ok) return gate
  return deleteCompanyNotice(id)
}
