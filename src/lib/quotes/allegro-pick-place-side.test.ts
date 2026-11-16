import { describe, expect, it } from 'vitest'
import { parsePickPlaceRows } from '@/lib/quotes/parse-altium-pick-place'
import { detectPickPlaceHeader } from '@/lib/quotes/pick-place-columns'
import { resolvePickPlaceColumnsFromAi } from '@/lib/quotes/spreadsheet-ai-resolve'

function parseDelimitedLine(line: string) {
  const bangCount = (line.match(/!/g) || []).length
  if (bangCount >= 2) {
    return line.split('!').map((cell) => cell.replace(/^#+\s*/, '').trim())
  }
  return line.split('\t').map((cell) => cell.trim())
}

function rowsFromText(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return false
      const compact = trimmed.replace(/[\s#!|-]/g, '')
      if (compact.length === 0 && /[-_|]{5,}/.test(trimmed.replace(/\s/g, ''))) return false
      return true
    })
    .map((line) => parseDelimitedLine(line))
    .filter((row) => row.some((cell) => cell.length > 0))
}

const ALLEGRO_SAMPLE = `#    refdes          !   symbol_x !   symbol_y ! rotation ! mirror ! symbol_name                      ! embedded_layer                  
#-----------------------------------------------------------------------------------------------------------------------
U26                  !   1394.113 !    685.000 !      270 !        ! IPEX                             !                                 
C267                 !    831.243 !    628.088 !      180 !        ! C0402                            !                                 
J10                  !    600.000 !   1339.000 !      180 !      m ! BM08B-GHS-TBT-PH                 !                                 
Q6                   !    630.000 !    552.500 !      270 !      m ! SOT-23                           !                                 
R123                 !    643.000 !    982.000 !      270 !      m ! SR0201                           !                                 
R143                 !    676.243 !    435.088 !       90 !        ! R0402                            !                                 
U18                  !    833.000 !    611.000 !       90 !      m ! SN74LVC_DCU_8P                   !                                 
U22                  !    416.244 !   1084.893 !        0 !      m ! OSCCC200X250X080                 !                                 
`

describe('Allegro pick-place mirror side', () => {
  const rows = rowsFromText(ALLEGRO_SAMPLE)

  it('규칙 파싱이 mirror 컬럼으로 양면을 인식한다', () => {
    const detected = detectPickPlaceHeader(rows)
    expect(detected).not.toBeNull()
    expect(rows[detected!.headerIndex]![detected!.columns.layer]).toBe('mirror')

    const result = parsePickPlaceRows(rows, 'place.txt')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.analysis.summary.smtSide).toBe('double')
    expect(result.analysis.classifiedRows.filter((row) => row.side === 'bottom').map((row) => row.designator)).toEqual(
      expect.arrayContaining(['J10', 'Q6', 'R123', 'U18', 'U22']),
    )
  })

  it('AI가 embedded_layer를 골라도 mirror로 보정한다', () => {
    const resolved = resolvePickPlaceColumnsFromAi(rows, {
      headerRowIndex: 0,
      columns: {
        designator: 'refdes',
        x: 'symbol_x',
        y: 'symbol_y',
        layer: 'embedded_layer',
        package: 'symbol_name',
        rotation: 'rotation',
      },
    })
    expect(resolved).not.toBeNull()
    expect(rows[0]![resolved!.columns.layer]).toBe('mirror')

    const result = parsePickPlaceRows(rows, 'place.txt', {
      forcedDetection: {
        headerIndex: resolved!.headerIndex,
        columns: resolved!.columns,
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.analysis.summary.smtSide).toBe('double')
  })

  it('AI가 layer라는 이름만 줘도 embedded_layer가 아니라 mirror를 쓴다', () => {
    const resolved = resolvePickPlaceColumnsFromAi(rows, {
      headerRowIndex: 0,
      columns: {
        designator: 'refdes',
        x: 'symbol_x',
        y: 'symbol_y',
        layer: 'layer',
        package: 'symbol_name',
        rotation: 'rotation',
      },
    })
    expect(resolved).not.toBeNull()
    expect(rows[0]![resolved!.columns.layer]).toBe('mirror')
  })
})
