import { createSupabaseClient } from '@/lib/supabase'
import type { ApprovalAttachmentFile } from './types'

export const APPROVAL_ATTACHMENTS_BUCKET = 'approval-attachments'
const MAX_FILE_SIZE = 20 * 1024 * 1024

export type UploadApprovalFilesResult =
  | { ok: true; files: ApprovalAttachmentFile[] }
  | { ok: false; detail: string }

function sanitizeFilename(name: string) {
  const base = name.trim() || 'file'
  return base.replace(/[^\w.\-()가-힣]/g, '_').slice(0, 120)
}

export function getApprovalAttachmentPublicUrl(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return '#'
  return `${url}/storage/v1/object/public/${APPROVAL_ATTACHMENTS_BUCKET}/${path}`
}

export function formatApprovalSaveError(detail: string) {
  if (/Could not find the table.*approvals/i.test(detail) || /relation.*approvals.*does not exist/i.test(detail)) {
    return 'approvals 테이블이 없습니다. Supabase SQL Editor에서 supabase/setup-approvals.sql 을 실행한 뒤, 다시 시도해 주세요.'
  }
  if (/Bucket not found/i.test(detail) || /approval-attachments/i.test(detail)) {
    return '첨부파일 저장소가 없습니다. Supabase SQL Editor에서 supabase/setup-approvals-storage.sql 을 실행해 주세요.'
  }
  return detail
}

export async function uploadApprovalFiles(
  approvalId: string,
  files: File[],
): Promise<UploadApprovalFilesResult> {
  if (!files.length) return { ok: true, files: [] }

  try {
    const supabase = createSupabaseClient()
    const uploaded: ApprovalAttachmentFile[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return { ok: false, detail: `${file.name} 파일이 20MB를 초과합니다.` }
      }

      const path = `${approvalId}/${Date.now()}-${sanitizeFilename(file.name)}`
      const { error } = await supabase.storage.from(APPROVAL_ATTACHMENTS_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

      if (error) {
        return { ok: false, detail: error.message }
      }

      uploaded.push({
        id: crypto.randomUUID(),
        name: file.name,
        path,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      })
    }

    return { ok: true, files: uploaded }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteApprovalAttachmentFiles(paths: string[]) {
  if (!paths.length) return { ok: true as const }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.storage.from(APPROVAL_ATTACHMENTS_BUCKET).remove(paths)
    if (error) return { ok: false as const, detail: error.message }
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
