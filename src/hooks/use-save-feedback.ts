'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useToast } from '@/components/ui/toast-provider'

type SaveFeedbackOptions = {
  /** 저장 후 모달 닫기 등 */
  close?: () => void
  /** 기본 true — 목록 갱신 */
  refresh?: boolean
}

/**
 * 등록·저장·수정·삭제 성공 시 토스트 + (선택) refresh 를 한곳에서 처리.
 */
export function useSaveFeedback() {
  const toast = useToast()
  const router = useRouter()

  const afterSave = useCallback(
    (message = '저장되었습니다.', options?: SaveFeedbackOptions) => {
      toast.success(message)
      options?.close?.()
      if (options?.refresh !== false) router.refresh()
    },
    [router, toast],
  )

  const afterCreate = useCallback(
    (message = '등록되었습니다.', options?: SaveFeedbackOptions) => {
      toast.success(message)
      options?.close?.()
      if (options?.refresh !== false) router.refresh()
    },
    [router, toast],
  )

  const afterUpdate = useCallback(
    (message = '수정되었습니다.', options?: SaveFeedbackOptions) => {
      toast.success(message)
      options?.close?.()
      if (options?.refresh !== false) router.refresh()
    },
    [router, toast],
  )

  const afterDelete = useCallback(
    (message = '삭제되었습니다.', options?: SaveFeedbackOptions) => {
      toast.success(message)
      options?.close?.()
      if (options?.refresh !== false) router.refresh()
    },
    [router, toast],
  )

  return { toast, afterSave, afterCreate, afterUpdate, afterDelete }
}
