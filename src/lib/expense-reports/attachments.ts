import { createSupabaseClient } from '@/lib/supabase'
import type { ExpenseReportAttachmentFile } from './types'

export const EXPENSE_REPORT_ATTACHMENTS_BUCKET = 'expense-report-attachments'
const MAX_FILE_SIZE = 20 * 1024 * 1024

export type UploadExpenseReportFilesResult =
  | { ok: true; files: ExpenseReportAttachmentFile[] }
  | { ok: false; detail: string }

function sanitizeFilename(name: string) {
  const base = name.trim() || 'file'
  return base.replace(/[^\w.\-()가-힣]/g, '_').slice(0, 120)
}

export function getExpenseReportAttachmentPublicUrl(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return '#'
  return `${url}/storage/v1/object/public/${EXPENSE_REPORT_ATTACHMENTS_BUCKET}/${path}`
}

export function formatExpenseReportSaveError(detail: string) {
  if (/Could not find the table.*expense_reports/i.test(detail) || /relation.*expense_reports.*does not exist/i.test(detail)) {
    return 'expense_reports 테이블이 없습니다. Supabase SQL Editor에서 supabase/setup-expense-reports.sql 을 실행한 뒤, 다시 시도해 주세요.'
  }
  if (/Bucket not found/i.test(detail) || /expense-report-attachments/i.test(detail)) {
    return '첨부파일 저장소가 없습니다. Supabase SQL Editor에서 supabase/setup-expense-reports-storage.sql 을 실행해 주세요.'
  }
  return detail
}

export async function uploadExpenseReportFiles(
  reportId: string,
  files: File[],
): Promise<UploadExpenseReportFilesResult> {
  if (!files.length) return { ok: true, files: [] }

  try {
    const supabase = createSupabaseClient()
    const uploaded: ExpenseReportAttachmentFile[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return { ok: false, detail: `${file.name} 파일이 20MB를 초과합니다.` }
      }

      const path = `${reportId}/${Date.now()}-${sanitizeFilename(file.name)}`
      const { error } = await supabase.storage.from(EXPENSE_REPORT_ATTACHMENTS_BUCKET).upload(path, file, {
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

export async function deleteExpenseReportAttachmentFiles(paths: string[]) {
  if (!paths.length) return { ok: true as const }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.storage.from(EXPENSE_REPORT_ATTACHMENTS_BUCKET).remove(paths)
    if (error) return { ok: false as const, detail: error.message }
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
