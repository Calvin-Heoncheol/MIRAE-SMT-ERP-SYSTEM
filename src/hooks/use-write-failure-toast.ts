'use client'

import { useCallback } from 'react'
import { useToast } from '@/components/ui/toast-provider'

type FailureLike = {
  ok: false
  reason?: string
  detail: string
}

/**
 * 쓰기 실패 안내.
 * auth → 권한 토스트, 그 외 → false (호출측에서 인라인 에러 유지)
 */
export function useWriteFailureToast() {
  const toast = useToast()

  const notifyAuthOrFailure = useCallback(
    (result: FailureLike, options?: { toastAllFailures?: boolean; title?: string }) => {
      if (result.reason === 'auth') {
        toast.error('권한이 없습니다', result.detail)
        return true
      }
      if (options?.toastAllFailures) {
        toast.error(options.title ?? '처리에 실패했습니다', result.detail)
        return true
      }
      return false
    },
    [toast],
  )

  const notifyForbidden = useCallback(
    (detail = '이 메뉴에 대한 접근 권한이 없습니다.') => {
      toast.error('접근 권한이 없습니다', detail)
    },
    [toast],
  )

  return { notifyAuthOrFailure, notifyForbidden, toast }
}
