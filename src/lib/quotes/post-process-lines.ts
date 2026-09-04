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

/** 후공정 분 — 소수 첫째 자리까지 (반올림) */
export function roundPostProcessMinutes(value: number | string | undefined | null) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 10) / 10
}

export function parsePostProcessMinutes(value: number | string | undefined | null) {
  return roundPostProcessMinutes(value)
}

export function formatPostProcessMinutesDisplay(minutes: number) {
  const rounded = roundPostProcessMinutes(minutes)
  if (rounded <= 0) return '—'
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function parsePostProcessSeconds(value: number | string | undefined | null) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(0, Math.round(n))
}

export function getPostProcessTimeBuffer(productionKind: PostProcessProductionKind = '양산') {
  return productionKind === '샘플' ? POST_PROCESS_SAMPLE_BUFFER : POST_PROCESS_MASS_BUFFER
}

/** 입력 초에 더해지는 여유 초 */
export function postProcessBufferSeconds(
  seconds: number,
  productionKind: PostProcessProductionKind = '양산',
) {
  const rawSeconds = parsePostProcessSeconds(seconds)
  if (rawSeconds <= 0) return 0
  return Math.round(rawSeconds * getPostProcessTimeBuffer(productionKind))
}

/** 여유율 반영 총 초 */
export function postProcessBufferedTotalSeconds(
  seconds: number,
  productionKind: PostProcessProductionKind = '양산',
) {
  const rawSeconds = parsePostProcessSeconds(seconds)
  if (rawSeconds <= 0) return 0
  return rawSeconds + postProcessBufferSeconds(rawSeconds, productionKind)
}

/** 입력 초 → 청구 분 (여유율 반영) */
export function postProcessSecondsToBilledMinutes(
  seconds: number,
  productionKind: PostProcessProductionKind = '양산',
) {
  const rawSeconds = parsePostProcessSeconds(seconds)
  if (rawSeconds <= 0) return 0
  const bufferedSeconds = postProcessBufferedTotalSeconds(rawSeconds, productionKind)
  return roundPostProcessMinutes(bufferedSeconds / 60)
}

export function formatPostProcessBilledMinutes(
  seconds: number,
  productionKind: PostProcessProductionKind = '양산',
) {
  return formatPostProcessMinutesDisplay(postProcessSecondsToBilledMinutes(seconds, productionKind))
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
  const total = lines.reduce(
    (sum, line) => sum + postProcessSecondsToBilledMinutes(parsePostProcessSeconds(line.seconds), productionKind),
    0,
  )
  return roundPostProcessMinutes(total)
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

function formsOrEmpty(
  lines: PostProcessLine[] | undefined,
  legacyTotal: number | undefined,
  fallbackName: string,
): PostProcessLineForm[] {
  const forms = resolvePostProcessLineForms(lines, legacyTotal, fallbackName)
  return forms.length > 0 ? forms : [emptyPostProcessLineForm()]
}

function lineHasContent(line: Pick<PostProcessLine, 'name' | 'minutes'> & { seconds?: number }) {
  return Boolean(line.name?.trim()) || hasPostProcessLineInput(line)
}

export type CategorizedPostProcessLineForms = {
  assemblyLines: PostProcessLineForm[]
  downloadLines: PostProcessLineForm[]
  testLines: PostProcessLineForm[]
  packingLines: PostProcessLineForm[]
}

/** 견적 로드 — 조립·다운로드·테스트·포장 4카테고리로 복원 */
export function resolveCategorizedPostProcessLineForms(post: {
  lines?: PostProcessLine[]
  assemblyLines?: PostProcessLine[]
  downloadLines?: PostProcessLine[]
  testLines?: PostProcessLine[]
  packingLines?: PostProcessLine[]
  postAssembly?: number
  postDownload?: number
  postTest?: number
  postPacking?: number
}): CategorizedPostProcessLineForms {
  const hasSplitCategories =
    Boolean(post.downloadLines?.some(lineHasContent)) ||
    Boolean(post.testLines?.some(lineHasContent)) ||
    Boolean(post.packingLines?.some(lineHasContent)) ||
    Number(post.postDownload) > 0 ||
    Number(post.postTest) > 0 ||
    Number(post.postPacking) > 0

  // 예전 통합 저장(lines 또는 assemblyLines에 전부) → 조립으로 복원
  if (post.lines?.length && !hasSplitCategories) {
    return {
      assemblyLines: postProcessLinesToForms(post.lines),
      downloadLines: [emptyPostProcessLineForm()],
      testLines: [emptyPostProcessLineForm()],
      packingLines: [emptyPostProcessLineForm()],
    }
  }

  if (
    post.assemblyLines ||
    post.downloadLines ||
    post.testLines ||
    post.packingLines ||
    Number(post.postAssembly) > 0 ||
    Number(post.postDownload) > 0 ||
    Number(post.postTest) > 0 ||
    Number(post.postPacking) > 0
  ) {
    return {
      assemblyLines: formsOrEmpty(post.assemblyLines, post.postAssembly, '조립'),
      downloadLines: formsOrEmpty(post.downloadLines, post.postDownload, '다운로드'),
      testLines: formsOrEmpty(post.testLines, post.postTest, '테스트'),
      packingLines: formsOrEmpty(post.packingLines, post.postPacking, '포장'),
    }
  }

  if (post.lines?.length) {
    return {
      assemblyLines: postProcessLinesToForms(post.lines),
      downloadLines: [emptyPostProcessLineForm()],
      testLines: [emptyPostProcessLineForm()],
      packingLines: [emptyPostProcessLineForm()],
    }
  }

  return {
    assemblyLines: [emptyPostProcessLineForm()],
    downloadLines: [emptyPostProcessLineForm()],
    testLines: [emptyPostProcessLineForm()],
    packingLines: [emptyPostProcessLineForm()],
  }
}

/** 조립·다운로드·테스트·포장(구) / lines(신) 을 하나의 공정 목록으로 합침 */
export function resolveUnifiedPostProcessLineForms(post: {
  lines?: PostProcessLine[]
  assemblyLines?: PostProcessLine[]
  downloadLines?: PostProcessLine[]
  testLines?: PostProcessLine[]
  packingLines?: PostProcessLine[]
  postAssembly?: number
  postDownload?: number
  postTest?: number
  postPacking?: number
}): PostProcessLineForm[] {
  const categorized = resolveCategorizedPostProcessLineForms(post)
  const merged = [
    ...categorized.assemblyLines,
    ...categorized.downloadLines,
    ...categorized.testLines,
    ...categorized.packingLines,
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
