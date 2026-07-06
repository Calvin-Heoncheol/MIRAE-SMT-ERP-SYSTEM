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
    cpn: String(item.cpn || '').trim(),
    materialName: String(item.materialName || '').trim(),
    specification: String(item.specification || '').trim(),
    mpn: String(item.mpn || '').trim(),
    quantity,
    unitPrice,
    orderAmount: computeMaterialPurchaseOrderLineAmount(quantity, unitPrice),
    status: '발주' as const,
    inboundQuantity: 0,
  }
}

export function validateMaterialPurchaseOrderItems(
  items: MaterialPurchaseOrderItemForm[],
  materials: Material[],
  supplier: string,
) {
  const parsed = items
    .map(materialPurchaseOrderItemFormToModel)
    .filter(
      (item) =>
        item.cpn ||
        item.materialName ||
        item.quantity > 0 ||
        item.orderAmount > 0,
    )

  if (!parsed.length) {
    return { ok: false as const, message: '자재를 1개 이상 입력하세요.' }
  }

  const validated: ReturnType<typeof materialPurchaseOrderItemFormToModel>[] = []

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index]
    if (!item.cpn) {
      return { ok: false as const, message: `${index + 1}행 CPN을 선택하세요.` }
    }
    if (item.quantity <= 0) {
      return { ok: false as const, message: `${index + 1}행 수량은 0보다 커야 합니다.` }
    }
    if (item.unitPrice < 0) {
      return { ok: false as const, message: `${index + 1}행 단가는 0 이상이어야 합니다.` }
    }

    const matched = resolveMaterialPurchaseOrderLineMaterial(materials, supplier, item)

    if (!matched) {
      if (item.materialId) {
        return {
          ok: false as const,
          message: `${index + 1}행 자재 정보가 등록 정보와 다릅니다. 목록에서 다시 선택하세요.`,
        }
      }
      return {
        ok: false as const,
        message: `${index + 1}행 해당 자재는 등록되어 있지 않습니다. CPN을 다시 확인해 주세요.`,
      }
    }

    validated.push({
      ...item,
      materialId: matched.id,
      cpn: matched.cpn,
      materialName: matched.materialName,
      specification: matched.specification,
      mpn: matched.mpn,
    })
  }

  return { ok: true as const, items: validated }
}
