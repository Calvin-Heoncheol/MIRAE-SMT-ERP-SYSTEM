import { defaultItemBulkRow } from '@/lib/items/bulk-paste'
import type { ItemFormState } from '@/lib/items/form-state'
import type { ItemMaterialType, ItemSupplyType } from '@/lib/items/types'
import { detectBomHeader } from '@/lib/quotes/bom-columns'
import { detectThroughHoleMount } from '@/lib/quotes/pick-place-mount-categories'
import { parseBomRows, type BomLine } from '@/lib/quotes/parse-altium-bom'

export type BomRawMaterialDraft = {
  form: ItemFormState
  source: 'custom' | 'altium'
  /** 원본 BOM 라인 수 (동일 CPN 병합 전) */
  sourceLineCount: number
}

export type ParseBomToRawMaterialsResult =
  | {
      ok: true
      drafts: BomRawMaterialDraft[]
      format: 'custom' | 'altium'
      warnings: string[]
      skippedWithoutCpn: number
    }
  | { ok: false; detail: string }

type CustomColumnMap = {
  cpn: number
  name: number
  materialType: number
  package: number
  specification: number
  mpn: number
  supplyType: number
}

function normalizeHeaderKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\w가-힣]+/g, '')
    .trim()
}

function headerMatches(cell: string, aliases: string[]) {
  const key = normalizeHeaderKey(cell)
  if (!key) return false
  return aliases.some((alias) => {
    const normalized = normalizeHeaderKey(alias)
    if (normalized.length <= 2) return key === normalized
    return key === normalized || key.includes(normalized) || normalized.includes(key)
  })
}

function findColumn(header: string[], aliases: string[], used: Set<number>) {
  for (let index = 0; index < header.length; index += 1) {
    if (used.has(index)) continue
    if (headerMatches(header[index] ?? '', aliases)) return index
  }
  return -1
}

function cellAt(cells: string[], index: number) {
  return index >= 0 ? String(cells[index] ?? '').trim() : ''
}

const CPN_ALIASES = [
  'cpn',
  'customerpartnumber',
  'customerpart',
  'customerpn',
  'ipn',
  'internalpartnumber',
  'itemcode',
  'itemno',
  'itemnumber',
  'materialcode',
  'materialno',
  '품목코드',
  '고객품번',
  '품번',
  '부품번호',
  '자재코드',
  '자재번호',
]

const NAME_ALIASES = [
  '품목명',
  '자재명',
  '부품명',
  'name',
  'partname',
  'materialname',
  'itemname',
  'description',
]
const PROCESS_ALIASES = ['공정구분', '공정', 'materialtype', 'mount', '실장', 'smd', 'dip']
const PACKAGE_ALIASES = ['패키지', 'package', 'pkg', 'footprint', '형태']
const SPEC_ALIASES = [
  '사양',
  '사양규격',
  '규격',
  'specification',
  'specificationdescription',
  'spec',
  'value',
  'comment',
  '품값',
  'description',
]
const MPN_ALIASES = [
  'mpn',
  'manufacturerpartnumber',
  'manufacturerpart',
  '제조사품번',
  '제조사부품번호',
]
const SUPPLY_ALIASES = ['도급사급', '도급', '사급', 'supply', 'supplytype']

function detectCustomRawMaterialHeader(rows: string[][]): { headerIndex: number; columns: CustomColumnMap } | null {
  let best: { headerIndex: number; columns: CustomColumnMap; score: number } | null = null

  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const header = (rows[i] ?? []).map((cell) => String(cell ?? '').trim())
    if (!header.some(Boolean)) continue

    const used = new Set<number>()
    const cpn = findColumn(header, CPN_ALIASES, used)
    if (cpn < 0) continue
    used.add(cpn)

    const name = findColumn(header, NAME_ALIASES, used)
    if (name >= 0) used.add(name)
    const materialType = findColumn(header, PROCESS_ALIASES, used)
    if (materialType >= 0) used.add(materialType)
    const pkg = findColumn(header, PACKAGE_ALIASES, used)
    if (pkg >= 0) used.add(pkg)
    const specification = findColumn(header, SPEC_ALIASES, used)
    if (specification >= 0) used.add(specification)
    const mpn = findColumn(header, MPN_ALIASES, used)
    if (mpn >= 0) used.add(mpn)
    const supplyType = findColumn(header, SUPPLY_ALIASES, used)

    // 커스텀 양식: CPN + (이름|사양|패키지|MPN) 중 하나
    if (name < 0 && pkg < 0 && specification < 0 && mpn < 0) continue

    let score = 20
    if (name >= 0) score += 4
    if (materialType >= 0) score += 2
    if (pkg >= 0) score += 2
    if (specification >= 0) score += 2
    if (mpn >= 0) score += 2
    // Altium 유도용 감점. Item Code 등 명확한 커스텀 CPN이면 유지
    const cpnHeader = header[cpn] ?? ''
    const strongCustomCpn = headerMatches(cpnHeader, [
      'itemcode',
      'itemno',
      'itemnumber',
      'materialcode',
      '품목코드',
      '자재코드',
      '자재번호',
    ])
    if (
      !strongCustomCpn &&
      headerMatches(header.join(' '), ['designator', 'refdes', '부품위치'])
    ) {
      score -= 8
    }

    const candidate = {
      headerIndex: i,
      columns: {
        cpn,
        name,
        materialType,
        package: pkg,
        specification,
        mpn,
        supplyType,
      },
      score,
    }
    if (!best || candidate.score > best.score) best = candidate
  }

  return best && best.score >= 20 ? { headerIndex: best.headerIndex, columns: best.columns } : null
}

function normalizeMaterialType(value: string): ItemMaterialType {
  const raw = value.trim().toUpperCase()
  if (!raw) return ''
  if (raw.includes('DIP') || raw.includes('수삽') || raw.includes('TH') || raw.includes('관통')) {
    return 'DIP'
  }
  if (raw.includes('SMD') || raw.includes('SMT') || raw.includes('표면')) {
    return 'SMD'
  }
  return ''
}

function inferMaterialTypeFromBom(line: Pick<BomLine, 'designators' | 'footprint' | 'description' | 'comment'>): ItemMaterialType {
  const designator = line.designators[0] || ''
  const detected = detectThroughHoleMount({
    package: line.footprint,
    description: line.description,
    value: line.comment,
    designator,
  })
  if (detected.isThroughHole) return 'DIP'
  return 'SMD'
}

function extractCpnFromAltiumRow(cells: string[], header: string[]): string {
  const cpnIndex = findColumn(header, CPN_ALIASES, new Set())
  if (cpnIndex >= 0) {
    const value = cellAt(cells, cpnIndex)
    if (value) return value
  }
  return ''
}

function buildForm(input: {
  cpn: string
  name: string
  materialType: ItemMaterialType
  package: string
  specification: string
  mpn: string
  supplyType: ItemSupplyType
  customerId: string
  customerName: string
}): ItemFormState {
  const form = defaultItemBulkRow(1)
  form.id = input.cpn.trim()
  form.name = input.name.trim() || input.cpn.trim()
  form.materialType = input.materialType || 'SMD'
  form.package = input.package.trim()
  form.specification = input.specification.trim()
  form.mpn = input.mpn.trim()
  form.supplyType = input.supplyType
  form.customerId = input.customerId
  form.customerName = input.customerName
  return form
}

function mergeDrafts(drafts: BomRawMaterialDraft[]): BomRawMaterialDraft[] {
  const map = new Map<string, BomRawMaterialDraft>()
  const withoutCode: BomRawMaterialDraft[] = []
  for (const draft of drafts) {
    const key = draft.form.id.trim().toLowerCase()
    if (!key) {
      withoutCode.push(draft)
      continue
    }
    const existing = map.get(key)
    if (!existing) {
      map.set(key, draft)
      continue
    }
    existing.sourceLineCount += draft.sourceLineCount
    // 빈 필드만 보강
    if (!existing.form.name.trim() && draft.form.name.trim()) existing.form.name = draft.form.name
    if (!existing.form.package.trim() && draft.form.package.trim()) {
      existing.form.package = draft.form.package
    }
    if (!existing.form.specification.trim() && draft.form.specification.trim()) {
      existing.form.specification = draft.form.specification
    }
    if (!existing.form.mpn.trim() && draft.form.mpn.trim()) existing.form.mpn = draft.form.mpn
    if (!existing.form.materialType && draft.form.materialType) {
      existing.form.materialType = draft.form.materialType
    }
  }
  return [...map.values(), ...withoutCode]
}

function parseCustomRawMaterialRows(
  rows: string[][],
  options: {
    customerId: string
    customerName: string
    supplyType: ItemSupplyType
  },
): ParseBomToRawMaterialsResult | null {
  const detected = detectCustomRawMaterialHeader(rows)
  if (!detected) return null

  const { headerIndex, columns } = detected
  const drafts: BomRawMaterialDraft[] = []
  let skippedWithoutCpn = 0
  const warnings: string[] = []

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = (rows[i] ?? []).map((cell) => String(cell ?? '').trim())
    if (!cells.some(Boolean)) continue

    const name = cellAt(cells, columns.name)
    const specification = cellAt(cells, columns.specification)
    const pkg = cellAt(cells, columns.package)
    const mpn = cellAt(cells, columns.mpn)

    const cpn = cellAt(cells, columns.cpn)
    if (!cpn) {
      // 품목코드만 비어 있고 다른 정보가 있으면 표에 남겨 사유 표시
      if (!name && !specification && !pkg && !mpn) continue
      skippedWithoutCpn += 1
      const materialType =
        normalizeMaterialType(cellAt(cells, columns.materialType)) ||
        (detectThroughHoleMount({
          package: pkg,
          description: name,
          value: specification,
          designator: '',
        }).isThroughHole
          ? 'DIP'
          : 'SMD')
      drafts.push({
        source: 'custom',
        sourceLineCount: 1,
        form: buildForm({
          cpn: '',
          name: name || specification || '(품목코드 없음)',
          materialType,
          package: pkg,
          specification: specification || name,
          mpn,
          supplyType: options.supplyType,
          customerId: options.customerId,
          customerName: options.customerName,
        }),
      })
      continue
    }

    const materialType =
      normalizeMaterialType(cellAt(cells, columns.materialType)) ||
      (detectThroughHoleMount({
        package: pkg,
        description: name,
        value: specification,
        designator: '',
      }).isThroughHole
        ? 'DIP'
        : 'SMD')

    const rowSupply = cellAt(cells, columns.supplyType)
    const supplyType =
      rowSupply.includes('사급')
        ? ('사급' as const)
        : rowSupply.includes('도급')
          ? ('도급' as const)
          : options.supplyType

    drafts.push({
      source: 'custom',
      sourceLineCount: 1,
      form: buildForm({
        cpn,
        name: name || specification || cpn,
        materialType,
        package: pkg,
        specification: specification || name,
        mpn,
        supplyType,
        customerId: options.customerId,
        customerName: options.customerName,
      }),
    })
  }

  if (!drafts.length) {
    return {
      ok: false,
      detail: '커스텀 BOM에서 등록할 행을 찾지 못했습니다. 품목코드(CPN) 열을 확인해 주세요.',
    }
  }

  if (skippedWithoutCpn > 0) {
    warnings.push(`품목코드 없는 행 ${skippedWithoutCpn}건 — 표에서 확인·보완하세요.`)
  }

  const missingMpn = drafts.filter((draft) => !draft.form.mpn.trim()).length
  if (missingMpn > 0) {
    warnings.push(`MPN 없는 행 ${missingMpn}건`)
  }

  return {
    ok: true,
    format: 'custom',
    drafts: mergeDrafts(drafts),
    warnings,
    skippedWithoutCpn,
  }
}

function parseAltiumRawMaterialRows(
  rows: string[][],
  fileName: string,
  options: {
    customerId: string
    customerName: string
    supplyType: ItemSupplyType
  },
): ParseBomToRawMaterialsResult {
  const parsed = parseBomRows(rows, fileName)
  if (!parsed.ok) return parsed

  const detected = detectBomHeader(rows)
  const header = detected ? rows[detected.headerIndex]!.map((cell) => String(cell ?? '').trim()) : []
  const cpnColumn = header.length > 0 ? findColumn(header, CPN_ALIASES, new Set()) : -1

  const drafts: BomRawMaterialDraft[] = []
  let skippedWithoutCpn = 0
  const warnings = [...parsed.analysis.summary.warnings]
  const usedKeys = new Set<string>()

  if (detected) {
    for (let r = detected.headerIndex + 1; r < rows.length; r += 1) {
      const cells = (rows[r] ?? []).map((cell) => String(cell ?? '').trim())
      if (!cells.some(Boolean)) continue

      let matched: BomLine | undefined
      for (const line of parsed.analysis.lines) {
        if (line.excluded) continue
        const des = line.designators[0] || ''
        if (des && cells.some((cell) => cell.includes(des))) {
          const key = `${line.designatorsRaw}||${line.comment}||${line.footprint}`.toLowerCase()
          if (usedKeys.has(key)) continue
          matched = line
          usedKeys.add(key)
          break
        }
      }
      if (!matched) continue

      let cpn = cpnColumn >= 0 ? cellAt(cells, cpnColumn) : extractCpnFromAltiumRow(cells, header)
      if (!cpn) cpn = matched.comment.trim()
      if (!cpn) {
        skippedWithoutCpn += 1
        drafts.push({
          source: 'altium',
          sourceLineCount: 1,
          form: buildForm({
            cpn: '',
            name: matched.description.trim() || matched.comment.trim() || '(품목코드 없음)',
            materialType: inferMaterialTypeFromBom(matched),
            package: matched.footprint,
            specification: matched.comment.trim() || matched.description.trim(),
            mpn: matched.mpn,
            supplyType: options.supplyType,
            customerId: options.customerId,
            customerName: options.customerName,
          }),
        })
        continue
      }

      const materialType = inferMaterialTypeFromBom(matched)
      const name = matched.description.trim() || matched.comment.trim() || cpn
      const specification = matched.comment.trim() || matched.description.trim()

      drafts.push({
        source: 'altium',
        sourceLineCount: 1,
        form: buildForm({
          cpn,
          name,
          materialType,
          package: matched.footprint,
          specification,
          mpn: matched.mpn,
          supplyType: options.supplyType,
          customerId: options.customerId,
          customerName: options.customerName,
        }),
      })
    }
  }

  // 헤더/행 매칭 실패 시 BomLine만으로 폴백
  if (!drafts.length) {
    for (const line of parsed.analysis.lines) {
      if (line.excluded) continue
      const cpn = line.comment.trim()
      if (!cpn) {
        skippedWithoutCpn += 1
        drafts.push({
          source: 'altium',
          sourceLineCount: 1,
          form: buildForm({
            cpn: '',
            name: line.description.trim() || '(품목코드 없음)',
            materialType: inferMaterialTypeFromBom(line),
            package: line.footprint,
            specification: line.comment.trim() || line.description.trim(),
            mpn: line.mpn,
            supplyType: options.supplyType,
            customerId: options.customerId,
            customerName: options.customerName,
          }),
        })
        continue
      }
      drafts.push({
        source: 'altium',
        sourceLineCount: 1,
        form: buildForm({
          cpn,
          name: line.description.trim() || cpn,
          materialType: inferMaterialTypeFromBom(line),
          package: line.footprint,
          specification: line.comment.trim() || line.description.trim(),
          mpn: line.mpn,
          supplyType: options.supplyType,
          customerId: options.customerId,
          customerName: options.customerName,
        }),
      })
    }
  }

  if (!drafts.length) {
    return {
      ok: false,
      detail:
        skippedWithoutCpn > 0
          ? `CPN/Comment가 비어 있어 등록할 자재가 없습니다. (${skippedWithoutCpn}행)`
          : 'Altium BOM에서 등록할 자재 행을 찾지 못했습니다.',
    }
  }

  if (skippedWithoutCpn > 0) {
    warnings.push(`품목코드 없는 행 ${skippedWithoutCpn}건 — 표에서 확인·보완하세요.`)
  }
  const missingMpn = drafts.filter((draft) => !draft.form.mpn.trim()).length
  if (missingMpn > 0) {
    warnings.push(`MPN 없는 행 ${missingMpn}건`)
  }
  if (cpnColumn < 0) {
    warnings.push('CPN 열을 찾지 못해 Comment를 품목코드로 사용했습니다.')
  }

  return {
    ok: true,
    format: 'altium',
    drafts: mergeDrafts(drafts),
    warnings,
    skippedWithoutCpn,
  }
}

/**
 * BOM 스프레드시트 → 원자재 일괄등록 초안.
 * 1) 커스텀 양식(품목코드/CPN 열) 우선
 * 2) 실패 시 Altium BOM 파서
 */
export function parseBomRowsToRawMaterials(
  rows: string[][],
  fileName: string,
  options: {
    customerId: string
    customerName: string
    supplyType: ItemSupplyType
  },
): ParseBomToRawMaterialsResult {
  if (!options.customerId.trim() || !options.customerName.trim()) {
    return { ok: false, detail: '고객사를 먼저 선택해 주세요.' }
  }
  if (options.supplyType !== '도급' && options.supplyType !== '사급') {
    return { ok: false, detail: '도급/사급을 먼저 선택해 주세요.' }
  }

  const normalized = rows
    .map((row) => row.map((cell) => String(cell ?? '').replace(/^"|"$/g, '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0))

  if (!normalized.length) {
    return { ok: false, detail: '파일이 비어 있습니다.' }
  }

  const custom = parseCustomRawMaterialRows(normalized, options)
  if (custom) return custom

  return parseAltiumRawMaterialRows(normalized, fileName, options)
}

/** 미리보기용: 이미 등록된 품목코드 집합과 대조 */
export function markExistingRawMaterialCodes(
  drafts: BomRawMaterialDraft[],
  existingCodes: Set<string>,
) {
  return drafts.map((draft) => ({
    ...draft,
    alreadyRegistered: existingCodes.has(draft.form.id.trim().toLowerCase()),
  }))
}
