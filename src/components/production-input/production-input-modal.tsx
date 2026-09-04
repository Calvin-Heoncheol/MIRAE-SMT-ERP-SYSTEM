'use client'

import { useEffect, useState } from 'react'
import { ProductionInputOrderHistory } from '@/components/production-input/production-input-order-history'
import { ProductionInputPanel } from '@/components/production-input/production-input-panel'
import { ProductionInputSideBadges } from '@/components/production-input/production-input-side-badges'
import { ErpModal } from '@/components/ui/erp-modal'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { SmtPcbSide } from '@/lib/smt/types'

type ProductionInputModalProps = {
  open: boolean
  order: ProductionOrderLine | null
  counts: Record<string, number>
  defectCounts: Record<string, number>
  config: ProductionInputConfig
  onClose: () => void
  onCountUpdated: (countKey: string, cumulative: number, defectCumulative?: number) => void
  showLineSelector?: boolean
  lineNo?: number | null
  onLineNoChange?: (lineNo: number | null) => void
  postProcessTeam?: PostProcessTeam
  initialPcbSide?: SmtPcbSide | null
}

export function ProductionInputModal({
  open,
  order,
  counts,
  defectCounts,
  config,
  onClose,
  onCountUpdated,
  showLineSelector = false,
  lineNo = null,
  onLineNoChange,
  postProcessTeam,
  initialPcbSide = null,
}: ProductionInputModalProps) {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [activeSide, setActiveSide] = useState<SmtPcbSide>('SINGLE')
  const isPostProcess = config.productionModule === 'post_process'

  useEffect(() => {
    if (!order) {
      setActiveSide('SINGLE')
      return
    }
    if (initialPcbSide === 'TOP' || initialPcbSide === 'BOT') {
      setActiveSide(initialPcbSide)
      return
    }
    setActiveSide(order.splitPcbSides ? 'TOP' : 'SINGLE')
  }, [order?.uiKey, order?.splitPcbSides, initialPcbSide])

  const title = order ? formatProductionProductName(order) : '생산 등록'
  const description = order
    ? [
        order.customer || '—',
        displayOrderPoNumber(order.customerPoNumber, order.orderNumber) || '—',
        order.productCode || null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  function handleCountUpdated(
    countKey: string,
    cumulative: number,
    defectCumulative?: number,
  ) {
    onCountUpdated(countKey, cumulative, defectCumulative)
    setHistoryRefreshKey((current) => current + 1)
  }

  return (
    <ErpModal
      open={open}
      title={title}
      description={description}
      size="form"
      fitContent
      dialogClassName="!max-w-[min(920px,96vw)]"
      headerAddon={
        order && !isPostProcess ? (
          <ProductionInputSideBadges order={order} activeSide={activeSide} compact />
        ) : null
      }
      onClose={onClose}
      contentClassName="min-h-0 overflow-hidden p-0"
    >
      <div className="flex max-h-[calc(94dvh-5.5rem)] flex-col lg:flex-row lg:items-stretch">
        <div className="min-h-0 min-w-0 shrink-0 overflow-y-auto overscroll-contain lg:w-[min(520px,58%)]">
          <ProductionInputPanel
            order={order}
            counts={counts}
            defectCounts={defectCounts}
            config={config}
            embedded
            showLineSelector={showLineSelector}
            lineNo={lineNo}
            onLineNoChange={onLineNoChange}
            postProcessTeam={postProcessTeam}
            initialPcbSide={initialPcbSide}
            onActiveSideChange={setActiveSide}
            onCountUpdated={handleCountUpdated}
          />
        </div>

        <ProductionInputOrderHistory
          order={order}
          config={config}
          postProcessTeam={postProcessTeam}
          highlightPcbSide={activeSide}
          refreshKey={historyRefreshKey}
        />
      </div>
    </ErpModal>
  )
}
