import type { PostProcessLine } from './types'

export type PostProcessLineForm = {
  name: string
  minutes: string
}

/** 후공정 분 — 소수 허용(예: 0.75), 소수 둘째 자리까지 */
export function parsePostProcessMinutes(value: number | string | undefined | null) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100) / 100
}

export function emptyPostProcessLineForm(): PostProcessLineForm {
  return { name: '', minutes: '' }
}

export function sumPostProcessLineMinutes(
  lines: Array<Pick<PostProcessLine, 'minutes'> | Pick<PostProcessLineForm, 'minutes'>>,
) {
  return lines.reduce((sum, line) => sum + parsePostProcessMinutes(line.minutes), 0)
}

export function postProcessLinesToModels(lines: PostProcessLineForm[]): PostProcessLine[] {
  return lines
    .map((line) => ({
      name: line.name.trim(),
      minutes: parsePostProcessMinutes(line.minutes),
    }))
    .filter((line) => line.name || line.minutes > 0)
}

export function postProcessLinesToForms(lines: PostProcessLine[] | undefined): PostProcessLineForm[] {
  if (!lines?.length) return [emptyPostProcessLineForm()]
  return lines.map((line) => ({
    name: line.name || '',
    minutes: line.minutes > 0 ? String(line.minutes) : '',
  }))
}

/** 구 견적(합계 숫자만) → 세부 행 1개로 복원 */
export function legacyMinutesToLineForms(
  totalMinutes: number,
  fallbackName: string,
): PostProcessLineForm[] {
  const minutes = parsePostProcessMinutes(totalMinutes)
  if (minutes <= 0) return []
  return [{ name: fallbackName, minutes: String(minutes) }]
}

export function resolvePostProcessLineForms(
  lines: PostProcessLine[] | undefined,
  legacyTotal: number | undefined,
  fallbackName: string,
): PostProcessLineForm[] {
  if (lines && lines.length > 0) return postProcessLinesToForms(lines)
  return legacyMinutesToLineForms(legacyTotal ?? 0, fallbackName)
}

/** 조립·테스트·포장(구) / lines(신) 을 하나의 공정 목록으로 합침 */
export function resolveUnifiedPostProcessLineForms(post: {
  lines?: PostProcessLine[]
  assemblyLines?: PostProcessLine[]
  testLines?: PostProcessLine[]
  packingLines?: PostProcessLine[]
  postAssembly?: number
  postTest?: number
  postPacking?: number
}): PostProcessLineForm[] {
  if (post.lines && post.lines.length > 0) {
    return postProcessLinesToForms(post.lines)
  }

  const merged = [
    ...resolvePostProcessLineForms(post.assemblyLines, post.postAssembly, '조립'),
    ...resolvePostProcessLineForms(post.testLines, post.postTest, '테스트'),
    ...resolvePostProcessLineForms(post.packingLines, post.postPacking, '포장'),
  ].filter((line) => line.name.trim() || parsePostProcessMinutes(line.minutes) > 0)

  return merged.length > 0 ? merged : [emptyPostProcessLineForm()]
}
