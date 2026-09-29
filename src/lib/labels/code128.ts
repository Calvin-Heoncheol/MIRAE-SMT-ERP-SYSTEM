const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232',
]
const STOP = '2331112'
const START_A = 103
const START_B = 104

/**
 * Code 128 막대 모듈 배열 (true = 검정). 콰이어트 존 없음.
 * 대문자·숫자만이면 Code Set A (CODESOFT 원본과 동일), 아니면 Code Set B.
 */
export function encodeCode128Modules(value: string): boolean[] | null {
  const text = String(value || '')
  if (!text) return null
  const codes = [...text].map((char) => char.charCodeAt(0))
  if (codes.some((code) => code < 32 || code > 126)) return null

  const useA = codes.every((code) => code <= 95)
  const start = useA ? START_A : START_B
  const values = codes.map((code) => code - 32)

  let checksum = start
  values.forEach((v, index) => {
    checksum += v * (index + 1)
  })

  const symbols = [start, ...values, checksum % 103].map((v) => PATTERNS[v])
  symbols.push(STOP)

  const modules: boolean[] = []
  for (const pattern of symbols) {
    let black = true
    for (const digit of pattern) {
      const run = Number(digit)
      for (let i = 0; i < run; i += 1) modules.push(black)
      black = !black
    }
  }
  return modules
}
