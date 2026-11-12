import { EMPTY_PAYMENT_TERM_SNAPSHOT } from '@/lib/partners/payment-term-snapshot'
import type { QuoteDetailInfo, QuoteListItem, SmtPcbBoard } from './types'

export function testSmtBoard(overrides: Partial<SmtPcbBoard> = {}): SmtPcbBoard {
  return {
    pcbName: 'PCB 1',
    chip: 300,
    icPin: 0,
    bga: 101,
    smtOdd: 10,
    smtSpecial: 0,
    smtSide: 'double',
    aoiEnabled: true,
    pcbWashEnabled: false,
    smtTopCount: 37,
    smtBotCount: 21,
    ...overrides,
  }
}

export function testQuote(
  overrides: Partial<QuoteListItem> = {},
  detail: QuoteDetailInfo = {},
): QuoteListItem {
  return {
    quoteId: 'q-1',
    quoteNumber: 'Q-TEST-001',
    quoteDate: '2026-11-03',
    quoteType: 'domestic',
    quoteStatus: 'draft',
    customer: '테스트고객',
    productName: '테스트보드',
    boardQty: 150,
    totalAmount: 0,
    paymentTerms: { ...EMPTY_PAYMENT_TERM_SNAPSHOT },
    createdByName: '',
    updatedByName: '',
    createdAt: '2026-11-03T00:00:00Z',
    ...overrides,
    detailInfo: {
      inputs: {
        smt: { pcbBoards: [testSmtBoard()] },
        dip: {
          dipBoards: [{ pcbName: 'PCB 1', dipGeneral: 4, dipConnector: 2, dipWire: 0, dipXLarge: 0 }],
        },
        postProcess: {
          assemblyLines: [{ name: '케이스 조립', seconds: 60, minutes: 1 }],
        },
      },
      settings: {
        materialCostPerUnit: 1200,
        metalMaskCost: 220000,
        includeMetalMask: true,
        productionKind: '양산',
        ...detail.settings,
      },
      ...(detail.inputs ? { inputs: detail.inputs } : {}),
    },
  }
}
