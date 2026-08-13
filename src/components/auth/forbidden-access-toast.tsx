'use client'

import { useEffect } from 'react'
import { useToast } from '@/components/ui/toast-provider'

/** /forbidden 진입 시 토스트로 한 번 안내 */
export function ForbiddenAccessToast({ fromPath }: { fromPath?: string }) {
  const toast = useToast()

  useEffect(() => {
    toast.error(
      '접근 권한이 없습니다',
      fromPath
        ? `요청 경로: ${fromPath}`
        : '현재 계정 부서·역할로는 이 페이지를 열 수 없습니다.',
    )
  }, [fromPath, toast])

  return null
}
