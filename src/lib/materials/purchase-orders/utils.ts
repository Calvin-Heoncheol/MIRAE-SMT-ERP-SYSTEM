import type { Material } from '@/lib/materials/types'
import { materialMatchesMpnValue, resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import type {
  MaterialPurchaseOrderLineItem,
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseOrderRecord,
  MaterialPurchaseOrderStatus,
} from './types'

export function formatMaterialPurchaseOrderMoney(amount: number) {
  return `₩${Math.round(Number(amount) || 0).toLocaleString('ko-KR')}`
}

export function formatMaterialPurchaseOrderDate(value: string | null | undefined) {
  if (!value) return ''
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : String(value)
}

export function todayYmdSeoul() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
}

export function addDaysYmd(baseYmd: string, days: number) {
  const match = baseYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return baseYmd
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseMaterialPurchaseOrderDateForSort(orderDate: string) {
  if (!orderDate) return 0
  const match = orderDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
  }
  const parsed = Date.parse(orderDate)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function sortMaterialPurchaseOrderGroupsNewestFirst(groups: MaterialPurchaseOrderListGroup[]) {
  return [...groups].sort((a, b) => {
    const dateDiff =
      parseMaterialPurchaseOrderDateForSort(b.orderDate) -
      parseMaterialPurchaseOrderDateForSort(a.orderDate)
    if (dateDiff !== 0) return dateDiff
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function normalizeMaterialPurchaseOrderStatus(
  value: string | null | undefined,
): MaterialPurchaseOrderStatus {
  const status = String(value || '').trim()
  if (status === '발주') return '발주'
  return '발주'
}

export function mapMaterialPurchaseOrderLineRecord(line: {
  id?: string
  material_id?: string | null
  cpn: string
  material_name: string
  specification: string
  mpn: string
  quantity: number
  unit_price: number
  order_amount: number
  status: string
  inbound_quantity: number
}): MaterialPurchaseOrderLineItem {
  return {
    lineId: line.id || '',
    materialId: line.material_id || null,
    materialCode: line.material_id || line.cpn || '',
    materialName: line.material_name || '',
    specification: line.specification || '',
    mpn: line.mpn || '',
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unit_price) || 0,
    orderAmount: Number(line.order_amount) || 0,
    status: normalizeMaterialPurchaseOrderStatus(line.status),
    inboundQuantity: Number(line.inbound_quantity) || 0,
  }
}

export function mapMaterialPurchaseOrderRecord(record: MaterialPurchaseOrderRecord): MaterialPurchaseOrderListGroup {
  const lines = [...(record.material_purchase_order_lines || [])].sort((a, b) => a.line_seq - b.line_seq)
  const items = lines.map(mapMaterialPurchaseOrderLineRecord)
  const hasInbound = items.some((item) => item.inboundQuantity > 0)

  return {
    orderId: record.id,
    orderNumber: record.id,
    orderDate: formatMaterialPurchaseOrderDate(record.order_date),
    deliveryDate: formatMaterialPurchaseOrderDate(record.delivery_date),
    supplier: record.supplier || '',
    sourceOrderId: record.source_order_id || null,
    coveredOrderLineId: record.covered_order_line_id || null,
    coveredProductQuantity: Math.max(0, Math.floor(Number(record.covered_product_quantity) || 0)),
    createdAt: record.created_at,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.orderAmount, 0),
    hasInbound,
  }
}

export function groupMaterialPurchaseOrdersFromRecords(
  records: MaterialPurchaseOrderRecord[],
): MaterialPurchaseOrderListGroup[] {
  return sortMaterialPurchaseOrderGroupsNewestFirst(records.map(mapMaterialPurchaseOrderRecord))
}

export function formatMaterialSummary(group: MaterialPurchaseOrderListGroup) {
  if (!group.items.length) return '-'
  const first = group.items[0]?.materialName.trim() || '-'
  if (group.items.length === 1) return first
  return `${first} 외 ${group.items.length - 1}건`
}

export function computeMaterialPurchaseOrderLineAmount(quantity: number, unitPrice: number) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const price = Math.max(0, Math.round(Number(unitPrice) || 0))
  return qty * price
}

/** 발주수량 − 누적입고 (입고예정·발주연동 입고 공통) */
export function computePurchaseOrderRemainingQuantity(orderedQuantity: number, inboundQuantity: number) {
  const ordered = Math.max(0, Number(orderedQuantity) || 0)
  const received = Math.max(0, Number(inboundQuantity) || 0)
  return Math.max(0, ordered - received)
}

export function formatInternalCodeLabel(code: string) {
  const value = code.trim()
  if (!value) return '—'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

export function formatMaterialOptionLabel(
  material: Material,
  field: 'id' | 'mpn' | 'idOrMpn' = 'idOrMpn',
) {
  const name = material.materialName.trim() || '-'
  const code = material.id.trim()
  const mpn = material.mpn.trim() || material.alternateMpns[0]?.trim() || ''

  if (field === 'idOrMpn') {
    const partNo = [code, mpn].filter(Boolean).join(' / ')
    if (partNo) return `${partNo} · ${name}`
    return name
  }

  if (field === 'mpn') {
    return `${mpn || '-'} · ${name}`
  }

  return `${code} · ${name}`
}

export function materialMatchesMpn(material: Material, mpn: string) {
  return materialMatchesMpnValue(material, mpn)
}

export type MaterialSearchField = 'id' | 'mpn' | 'idOrMpn'

export function filterMaterialsForPurchaseOrder(
  materials: Material[],
  supplier: string | null | undefined,
  query: string,
  field?: MaterialSearchField,
) {
  const q = query.trim().toLowerCase()
  const supplierTrim = String(supplier ?? '').trim()

  return materials.filter((material) => {
    if (supplierTrim && material.supplier.trim() && material.supplier.trim() !== supplierTrim) {
      return false
    }
    if (!q) return true

    if (field === 'id') {
      return material.id.trim().toLowerCase().includes(q)
    }

    if (field === 'mpn' || field === 'idOrMpn') {
      const idMatch = material.id.trim().toLowerCase().includes(q)
      const mpns = [material.mpn, ...material.alternateMpns]
      const mpnMatch = mpns.some((value) => value.trim().toLowerCase().includes(q))
      if (field === 'mpn') return mpnMatch
      return idMatch || mpnMatch
    }

    const haystack = [
      material.materialName,
      material.id,
      material.mpn,
      ...material.alternateMpns,
      material.specification,
      material.supplier,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function resolveMaterialFromFieldInput(
  materials: Material[],
  supplier: string | null | undefined,
  field: 'id' | 'mpn',
  value: string,
): Material | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const byCode = resolveMaterialByInventoryCode(materials, trimmed, { supplier })
  if (byCode) return byCode

  const candidates = filterMaterialsForPurchaseOrder(materials, supplier, trimmed, field).filter((material) => {
    if (field === 'id') return material.id.trim() === trimmed
    return materialMatchesMpn(material, trimmed)
  })

  if (candidates.length === 1) return candidates[0]
  return null
}

export function resolveMaterialFromCodeOrMpnInput(
  materials: Material[],
  supplier: string | null | undefined,
  value: string,
): Material | null {
  return resolveMaterialByInventoryCode(materials, value, { supplier })
}

/** @deprecated Use resolveMaterialFromCodeOrMpnInput */
export function resolveMaterialFromCpnOrMpnInput(
  materials: Material[],
  supplier: string | null | undefined,
  value: string,
): Material | null {
  return resolveMaterialFromCodeOrMpnInput(materials, supplier, value)
}

export function resolveMaterialFromInput(
  materials: Material[],
  supplier: string | null | undefined,
  materialName: string,
  materialCode?: string,
): Material | null {
  const name = materialName.trim()
  if (!name) return null

  const codeTrim = String(materialCode || '').trim()
  const candidates = filterMaterialsForPurchaseOrder(materials, supplier, name).filter((material) => {
    if (material.materialName.trim() !== name) return false
    if (codeTrim && material.id.trim() !== codeTrim) return false
    return true
  })

  if (candidates.length === 1) return candidates[0]
  if (!codeTrim) {
    const exactName = candidates.filter((material) => material.materialName.trim() === name)
    if (exactName.length === 1) return exactName[0]
  }
  return null
}

export function resolveMaterialPurchaseOrderLineMaterial(
  materials: Material[],
  supplier: string | null | undefined,
  item: { materialId?: string | null; materialName: string; materialCode: string; mpn: string },
): Material | null {
  const materialId = String(item.materialId || '').trim()
  const materialCode = item.materialCode.trim()
  const code = materialId || materialCode

  if (code) {
    const byCode = resolveMaterialByInventoryCode(materials, code, { supplier })
    if (byCode) return byCode
  }

  return resolveMaterialFromInput(materials, supplier, item.materialName, materialCode)
}
