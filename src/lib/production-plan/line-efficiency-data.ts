import { normalizeBomProcess } from '@/lib/bom/types'
import { fetchSmtLinesWithEquipment } from '@/lib/equipment/repository'
import { summarizeSmtLineCapacity } from '@/lib/equipment/types'
import { createSupabaseClient } from '@/lib/supabase'
import { computeBomSmdPoints, type BomPointsLine, type SmtLineCapacity } from './line-efficiency'

const PAGE_SIZE = 1000

async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ ok: true; rows: T[] } | { ok: false; detail: string }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) return { ok: false, detail: error.message }
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { ok: true, rows }
}

type BomPointsRow = {
  parent_product_id: string | null
  child_product_id: string | null
  quantity_per: number | null
  process?: string | null
}

/** 반제품(부모) id → BOM 1대당 SMD 실장 점수. 조회 실패 시 빈 맵 */
export async function fetchBomSmdPointsByParent(): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  try {
    const supabase = createSupabaseClient()
    let bomRows = await fetchAllPages<BomPointsRow>((from, to) =>
      supabase
        .from('bom_items')
        .select('parent_product_id, child_product_id, quantity_per, process')
        .range(from, to),
    )
    if (!bomRows.ok && bomRows.detail.includes('process')) {
      bomRows = await fetchAllPages<BomPointsRow>((from, to) =>
        supabase
          .from('bom_items')
          .select('parent_product_id, child_product_id, quantity_per')
          .range(from, to),
      )
    }
    if (!bomRows.ok) return result

    const materialRows = await fetchAllPages<{ id: string; material_type: string | null }>(
      (from, to) =>
        supabase
          .from('items')
          .select('id, material_type')
          .not('material_type', 'is', null)
          .range(from, to),
    )
    const materialTypeById = new Map<string, string>(
      materialRows.ok
        ? materialRows.rows.map((row) => [
            String(row.id || '').trim(),
            String(row.material_type || '').trim().toUpperCase(),
          ])
        : [],
    )

    const linesByParent = new Map<string, BomPointsLine[]>()
    for (const row of bomRows.rows) {
      const parentId = String(row.parent_product_id || '').trim()
      const childId = String(row.child_product_id || '').trim()
      if (!parentId || !childId) continue
      const list = linesByParent.get(parentId) ?? []
      list.push({
        childProductId: childId,
        quantityPer: Number(row.quantity_per) || 0,
        process: normalizeBomProcess(row.process),
      })
      linesByParent.set(parentId, list)
    }

    for (const [parentId, lines] of linesByParent) {
      const points = computeBomSmdPoints(lines, materialTypeById)
      if (points > 0) result.set(parentId, points)
    }
  } catch {
    return result
  }
  return result
}

/** 설비등록 — 사용중 라인별 사양 CPH 합계. 테이블 없으면 빈 배열 */
export async function fetchSmtLineCapacities(): Promise<SmtLineCapacity[]> {
  const linesResult = await fetchSmtLinesWithEquipment()
  if (!linesResult.ok) return []
  return linesResult.lines
    .filter((line) => line.isActive)
    .map((line) => {
      const summary = summarizeSmtLineCapacity(line)
      return {
        lineNo: line.lineNo,
        name: line.name,
        ratedCph: summary.ratedCphTotal,
        mounterCount: summary.mounterCount,
      }
    })
}
