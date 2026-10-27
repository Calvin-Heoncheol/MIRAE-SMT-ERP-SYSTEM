import { describe, expect, it } from 'vitest'
import {
  formatBomLineDescription,
  parseBomBulkPaste,
  parseBomLineDescription,
} from './bulk-paste'

describe('BOM 품목명/규격 칸', () => {
  it('품목명 / 규격 / MPN 을 한 칸으로 합치고 다시 나눈다', () => {
    const text = formatBomLineDescription({
      sourceName: 'CAP',
      sourceSpec: '1608 100nF',
      sourceMpn: 'GRM188R71C104KA01D',
    })
    expect(text).toBe('CAP / 1608 100nF / GRM188R71C104KA01D')
    expect(parseBomLineDescription(text)).toEqual({
      sourceName: 'CAP',
      sourceSpec: '1608 100nF',
      sourceMpn: 'GRM188R71C104KA01D',
    })
  })

  it('구분자 없는 값과 1/4W 같은 슬래시는 품목명으로 둔다', () => {
    expect(parseBomLineDescription('RES 10k 1/4W 1608')).toEqual({
      sourceName: 'RES 10k 1/4W 1608',
      sourceSpec: '',
      sourceMpn: '',
    })
  })

  it('헤더 없는 6열(화면 순서) 붙여넣기를 읽는다', () => {
    const [row] = parseBomBulkPaste('C1608-104K\tC1608-104K-B\tSMD\tCAP / 1608 100nF / GRM188\t2\tC1,C2')
    expect(row).toMatchObject({
      partCode: 'C1608-104K',
      alternates: 'C1608-104K-B',
      process: 'smd',
      name: 'CAP',
      spec: '1608 100nF',
      mpn: 'GRM188',
      quantityPer: '2',
      designators: 'C1,C2',
    })
  })

  it('예전 8열 붙여넣기도 그대로 읽는다', () => {
    const [row] = parseBomBulkPaste('C1\tCAP\tSMD\t1608\tGRM188\t3\tC1,C2,C3\t')
    expect(row).toMatchObject({ partCode: 'C1', name: 'CAP', spec: '1608', mpn: 'GRM188', quantityPer: '3' })
  })
})
