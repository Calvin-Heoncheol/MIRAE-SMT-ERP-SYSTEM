'use client'

import { useRef } from 'react'
import { getApprovalAttachmentPublicUrl } from '@/lib/approvals/attachments'
import type { ApprovalAttachmentFile } from '@/lib/approvals/types'
import { PRINT_BODY, PRINT_SECTION_TITLE } from '@/lib/documents/print-classes'

type ApprovalAttachmentsFieldProps = {
  description: string
  files: ApprovalAttachmentFile[]
  pendingFiles: File[]
  readOnly?: boolean
  onDescriptionChange: (value: string) => void
  onFilesChange: (files: ApprovalAttachmentFile[]) => void
  onPendingFilesChange: (files: File[]) => void
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function ApprovalAttachmentsField({
  description,
  files,
  pendingFiles,
  readOnly = false,
  onDescriptionChange,
  onFilesChange,
  onPendingFilesChange,
}: ApprovalAttachmentsFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    if (!picked.length) return
    onPendingFilesChange([...pendingFiles, ...picked])
    event.target.value = ''
  }

  function removePending(index: number) {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index))
  }

  function removeUploaded(file: ApprovalAttachmentFile) {
    onFilesChange(files.filter((item) => item.id !== file.id))
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className={`${PRINT_SECTION_TITLE} mb-1 block text-xs font-semibold tracking-wide text-slate-500`}>3. 첨부서류</span>
        {readOnly ? (
          <div className={`${PRINT_BODY} min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800`}>
            {description || '-'}
          </div>
        ) : (
          <textarea
            value={description}
            rows={2}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="예: 납부 안내서 1부, 견적서 1부"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          />
        )}
      </label>

      <div className="no-print">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">첨부 파일</p>
          {!readOnly ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="no-print rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                파일 선택
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilePick}
              />
            </>
          ) : null}
        </div>

        {files.length === 0 && pendingFiles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            첨부된 파일이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <a
                    href={getApprovalAttachmentPublicUrl(file.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-blue-700 hover:underline"
                  >
                    {file.name}
                  </a>
                  <p className="text-[11px] text-slate-500">{formatFileSize(file.size)}</p>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => removeUploaded(file)}
                    className="no-print shrink-0 text-xs font-semibold text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                ) : null}
              </li>
            ))}
            {pendingFiles.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-amber-900">{file.name}</p>
                  <p className="text-[11px] text-amber-700">
                    {formatFileSize(file.size)} · 저장 시 업로드
                  </p>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => removePending(index)}
                    className="no-print shrink-0 text-xs font-semibold text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!readOnly ? (
          <p className="mt-2 text-[11px] text-slate-400">파일당 최대 20MB · 저장 시 Supabase Storage에 업로드됩니다.</p>
        ) : null}
      </div>
    </div>
  )
}
