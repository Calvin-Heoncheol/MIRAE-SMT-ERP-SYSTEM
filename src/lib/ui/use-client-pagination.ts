'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

/** SSR·초기 렌더 기본값 (실측 전) */
export const ERP_LIST_PAGE_SIZE = 15

/** 테이블 행 대략 높이 (패딩 포함) */
const ROW_HEIGHT_PX = 40
/**
 * 검색/필터/페이지네이션/메인 패딩 등 표 밖 영역.
 * 하단에 여유 공백이 남도록 약간 넉넉히 예약.
 */
const RESERVED_CHROME_DESKTOP_PX = 290
const RESERVED_CHROME_MOBILE_PX = 330
const MIN_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 45

function computeViewportPageSize(viewportHeight: number, viewportWidth: number) {
  const reserved =
    viewportWidth >= 1024 ? RESERVED_CHROME_DESKTOP_PX : RESERVED_CHROME_MOBILE_PX
  const available = viewportHeight - reserved
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.floor(available / ROW_HEIGHT_PX)))
}

/** 모니터(뷰포트) 높이에 맞춰 한 페이지 행 수 산출 */
export function useViewportListPageSize() {
  const [pageSize, setPageSize] = useState(ERP_LIST_PAGE_SIZE)

  useEffect(() => {
    function update() {
      setPageSize(computeViewportPageSize(window.innerHeight, window.innerWidth))
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return pageSize
}

/**
 * 클라이언트 목록 페이지네이션.
 * pageSize를 넘기지 않으면 화면 높이에 따라 자동 조절됩니다.
 */
export function useClientPagination<T>(items: T[], fixedPageSize?: number) {
  const adaptivePageSize = useViewportListPageSize()
  const pageSize = fixedPageSize ?? adaptivePageSize

  const [page, setPage] = useState(1)
  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)

  const prevTotalCountRef = useRef(totalCount)
  const prevPageSizeRef = useRef(pageSize)

  useEffect(() => {
    if (prevTotalCountRef.current !== totalCount) {
      prevTotalCountRef.current = totalCount
      setPage(1)
    }
  }, [totalCount])

  useEffect(() => {
    if (prevPageSizeRef.current === pageSize) return
    const previousSize = prevPageSizeRef.current
    prevPageSizeRef.current = pageSize
    setPage((current) => {
      const startIndex = (current - 1) * previousSize
      return Math.max(1, Math.floor(startIndex / pageSize) + 1)
    })
  }, [pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const safePage = Math.min(Math.max(1, page), totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, totalCount)

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    totalCount,
    rangeStart,
    rangeEnd,
  }
}
