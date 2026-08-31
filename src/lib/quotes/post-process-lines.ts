import {
  POST_PROCESS_MASS_BUFFER,
  POST_PROCESS_SAMPLE_BUFFER,
} from './constants'
import type { PostProcessLine } from './types'

export type PostProcessLineForm = {
  name: string
  seconds: string
}

export type PostProcessProductionKind = '샘플' | '양산'

/** 후공정 분 — 소수 허용(예: 0.75), 소수 둘째 자리까지 */
export function parsePostProcessMinutes(value: number | string | undefined | null) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100) / 100
}

export function parsePostProcessSeconds(value: number | string | undefined | null) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(0, Math.round(n))
}

export function getPostProcessTimeBuffer(productionKind: PostProcessProductionKind = '양산') {
  return productionKind === '샘플' ? POST_PROCESS_SAMPLE_BUFFER : POST_PROCESS_MASS_BUFFER
}

/** 입력 초 → 청구 분 (여유율 반영) */
export function postProcessSecondsToBilledMinutes(
  seconds: number,
  productionKind: PostProcessProductionKind = '양산',
) {
  const rawSeconds = parsePostProcessSeconds(seconds)
  if (rawSeconds <= 0) return 0
  const bufferedSeconds = rawSeconds * (1 + getPostProcessTimeBuffer(productionKind))
  return Math.round((bufferedSeconds / 60) * 100) / 100
}

export function formatPostProcessBilledMinutes(
  seconds: number,
  productionKind: PostProcessProductionKind = '양산',
) {
  const minutes = postProcessSecondsToBilledMinutes(seconds, productionKind)
  if (minutes <= 0) return '—'
  const rounded = Math.round(minutes * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function emptyPostProcessLineForm(): PostProcessLineForm {
  return { name: '', seconds: '' }
}

export function hasPostProcessLineInput(line: {
  seconds?: number | string | null
  minutes?: number | string | null
}) {
  if ('seconds' in line && line.seconds != null && parsePostProcessSeconds(line.seconds) > 0) {
    return true
  }
  if ('minutes' in line && line.minutes != null && parsePostProcessMinutes(line.minutes) > 0) {
    return true
  }
  return false
}

/** 저장된 후공정 행 — minutes 합계 */
export function sumPostProcessLineMinutes(
  lines: Array<Pick<PostProcessLine, 'minutes'> | Pick<PostProcessLineForm, 'seconds'>>,
) {
  return lines.reduce((sum, line) => {
    if ('minutes' in line && line.minutes != null) {
      return sum + parsePostProcessMinutes(line.minutes)
    }
    return sum
  }, 0)
}

/** 입력 폼 — 초 입력 기준 청구 분 합계 */
export function sumPostProcessBilledMinutes(
  lines: PostProcessLineForm[],
  productionKind: PostProcessProductionKind = '양산',
) {
  return lines.reduce(
    (sum, line) => sum + postProcessSecondsToBilledMinutes(parsePostProcessSeconds(line.seconds), productionKind),
    0,
  )
}

export function postProcessLinesToModels(
  lines: PostProcessLineForm[],
  productionKind: PostProcessProductionKind = '양산',
): PostProcessLine[] {
  return lines
    .map((line) => {
      const seconds = parsePostProcessSeconds(line.seconds)
      const minutes = postProcessSecondsToBilledMinutes(seconds, productionKind)
      return {
        name: line.name.trim(),
        seconds: seconds > 0 ? seconds : undefined,
        minutes,
      }
    })
    .filter((line) => line.name || line.minutes > 0)
}

export function postProcessLinesToForms(lines: PostProcessLine[] | undefined): PostProcessLineForm[] {
  if (!lines?.length) return [emptyPostProcessLineForm()]
  return lines.map((line) => ({
    name: line.name || '',
    seconds:
      line.seconds != null && line.seconds > 0
        ? String(Math.round(line.seconds))
        : line.minutes > 0
          ? String(Math.round(line.minutes * 60))
          : '',
  }))
}

/** 구 견적(합계 분만) → 세부 행 1개로 복원 */
export function legacyMinutesToLineForms(
  totalMinutes: number,
  fallbackName: string,
): PostProcessLineForm[] {
  const minutes = parsePostProcessMinutes(totalMinutes)
  if (minutes <= 0) return []
  return [{ name: fallbackName, seconds: String(Math.round(minutes * 60)) }]
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
  ].filter((line) => line.name.trim() || parsePostProcessSeconds(line.seconds) > 0)

  return merged.length > 0 ? merged : [emptyPostProcessLineForm()]
}

/** 미리보기·저장 행 → 청구 분 (초 입력 우선, 없으면 저장된 minutes) */
export function resolvePostProcessLineBilledMinutes(
  line: {
    seconds?: number | string | null
    minutes?: number | string | null
  },
  productionKind: PostProcessProductionKind = '양산',
) {
  const seconds = parsePostProcessSeconds(line.seconds)
  if (seconds > 0) return postProcessSecondsToBilledMinutes(seconds, productionKind)
  return parsePostProcessMinutes(line.minutes)
}
