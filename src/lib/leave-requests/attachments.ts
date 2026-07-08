import { buildStorageObjectPath } from '@/lib/documents/storage-filename'
import { createSupabaseClient } from '@/lib/supabase'
import type { LeaveRequestAttachmentFile } from './types'

export const LEAVE_REQUEST_ATTACHMENTS_BUCKET = 'leave-request-attachments'
const MAX_FILE_SIZE = 20 * 1024 * 1024

export type UploadLeaveRequestFilesResult =
  | { ok: true; files: LeaveRequestAttachmentFile[] }
  | { ok: false; detail: string }

export function getLeaveRequestAttachmentPublicUrl(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return '#'
  return `${url}/storage/v1/object/public/${LEAVE_REQUEST_ATTACHMENTS_BUCKET}/${path}`
}

export async function uploadLeaveRequestFiles(
  requestId: string,
  files: File[],
): Promise<UploadLeaveRequestFilesResult> {
  if (!files.length) return { ok: true, files: [] }

  try {
    const supabase = createSupabaseClient()
    const uploaded: LeaveRequestAttachmentFile[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return { ok: false, detail: `${file.name} 파일이 20MB를 초과합니다.` }
      }

      const path = buildStorageObjectPath(requestId, file.name)
      const { error } = await supabase.storage.from(LEAVE_REQUEST_ATTACHMENTS_BUCKET).upload(path, file, {
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

export async function deleteLeaveRequestAttachmentFiles(paths: string[]) {
  if (!paths.length) return { ok: true as const }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.storage.from(LEAVE_REQUEST_ATTACHMENTS_BUCKET).remove(paths)
    if (error) return { ok: false as const, detail: error.message }
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
