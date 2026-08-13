import type { Material } from '@/lib/materials/types'
import type { MaterialPurchaseOrderItemForm } from './form-state'
import {
  computeMaterialPurchaseOrderLineAmount,
  resolveMaterialPurchaseOrderLineMaterial,
} from './utils'

export function materialPurchaseOrderItemFormToModel(item: MaterialPurchaseOrderItemForm) {
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
  const materialId = String(item.materialId || '').trim()

  return {
    materialId: materialId || null,
    materialCode: String(item.materialCode || '').trim(),
    materialName: String(item.materialName || '').trim(),
    specification: String(item.specification || '').trim(),
    mpn: String(item.mpn || '').trim(),
    quantity,
    unitPrice,
    orderAmount: computeMaterialPurchaseOrderLineAmount(quantity, unitPrice),
    status: '발주' as const,
    inboundQuantity: 0,
    deliveryDate: String(item.deliveryDate || '').trim().slice(0, 10),
  }
}

export function validateMaterialPurchaseOrderItems(
  items: MaterialPurchaseOrderItemForm[],
  materials: Material[],
  supplier: string,
  fallbackDeliveryDate = '',
) {
  const parsed = items
    .map(materialPurchaseOrderItemFormToModel)
    .filter(
      (item) =>
        item.materialCode ||
        item.materialName ||
        item.quantity > 0 ||
        item.orderAmount > 0,
    )

  if (!parsed.length) {
    return { ok: false as const, message: '자재를 1개 이상 입력하세요.' }
  }

  const headerDelivery = String(fallbackDeliveryDate || '').trim().slice(0, 10)
  const validated: ReturnType<typeof materialPurchaseOrderItemFormToModel>[] = []

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index]
    if (!item.materialCode) {
      return { ok: false as const, message: `${index + 1}행 자재코드를 선택하세요.` }
    }
    if (item.quantity <= 0) {
      return { ok: false as const, message: `${index + 1}행 수량은 0보다 커야 합니다.` }
    }
    if (item.unitPrice < 0) {
      return { ok: false as const, message: `${index + 1}행 단가는 0 이상이어야 합니다.` }
    }

    const deliveryDate = item.deliveryDate || headerDelivery
    if (!deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      return {
        ok: false as const,
        message: `${index + 1}행 납기일을 입력하세요. (또는 상단 기본 납기일을 지정)`,
      }
    }

    const matched = resolveMaterialPurchaseOrderLineMaterial(materials, supplier, item)

    if (!matched) {
      return {
        ok: false as const,
        message: `${index + 1}행(${item.materialCode}) 품목등록에 없는 자재입니다. 품목등록 후 다시 구매발주하세요.`,
      }
    }

    validated.push({
      ...item,
      materialId: matched.id,
      materialCode: matched.id,
      materialName: matched.materialName,
      specification: matched.specification,
      mpn: matched.mpn,
      deliveryDate,
    })
  }

  return { ok: true as const, items: validated }
}
