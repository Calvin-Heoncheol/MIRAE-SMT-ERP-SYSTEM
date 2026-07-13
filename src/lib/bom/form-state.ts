import type { BomGroup, BomLinePayload } from './types'

export type BomFormLine = {
  key: string
  childProductId: string
  quantityPer: string
  note: string
}

export type BomFormState = {
  parentProductId: string
  lines: BomFormLine[]
}

let lineKeySeq = 0

export function createBomFormLine(
  partial?: Partial<Omit<BomFormLine, 'key'>> & { key?: string },
): BomFormLine {
  lineKeySeq += 1
  return {
    key: partial?.key || `bom-line-${lineKeySeq}`,
    childProductId: partial?.childProductId || '',
    quantityPer: partial?.quantityPer ?? '1',
    note: partial?.note || '',
  }
}

export function emptyBomForm(): BomFormState {
  return {
    parentProductId: '',
    lines: [createBomFormLine()],
  }
}

export function bomGroupToForm(group: BomGroup): BomFormState {
  return {
    parentProductId: group.parentProductId,
    lines: group.lines.length
      ? group.lines.map((line) =>
          createBomFormLine({
            childProductId: line.childProductId,
            quantityPer: String(line.quantityPer),
            note: line.note,
          }),
        )
      : [createBomFormLine()],
  }
}

export function formToBomLinePayloads(form: BomFormState): BomLinePayload[] {
  return form.lines
    .map((line) => ({
      childProductId: line.childProductId.trim(),
      quantityPer: Number(line.quantityPer),
      note: line.note.trim(),
    }))
    .filter((line) => line.childProductId)
}

export function validateBomForm(form: BomFormState): string | null {
  if (!form.parentProductId.trim()) {
    return '부모 품목을 선택해 주세요.'
  }

  const payloads = formToBomLinePayloads(form)
  if (!payloads.length) {
    return '구성 품목을 하나 이상 추가해 주세요.'
  }

  const seen = new Set<string>()
  for (const line of payloads) {
    if (line.childProductId === form.parentProductId.trim()) {
      return '부모 품목과 같은 품목을 구성에 넣을 수 없습니다.'
    }
    if (!Number.isFinite(line.quantityPer) || line.quantityPer <= 0) {
      return '소요량은 0보다 큰 숫자여야 합니다.'
    }
    if (seen.has(line.childProductId)) {
      return `구성 품목 ${line.childProductId} 이(가) 중복되었습니다.`
    }
    seen.add(line.childProductId)
  }

  return null
}
