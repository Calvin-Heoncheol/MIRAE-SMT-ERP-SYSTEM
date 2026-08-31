import type { DipBoardForm, SmtBoardForm } from '@/lib/quotes/form-state'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'
import type { AltiumPickPlaceAnalysis } from '@/lib/quotes/parse-altium-pick-place'
import type { QuoteType } from '@/lib/quotes/types'

export type AiQuoteDraft = {
  quoteType: QuoteType
  productName: string
  smtForms: SmtBoardForm[]
  dipForms: DipBoardForm[]
  pickPlaceAnalysis: AltiumPickPlaceAnalysis | null
  bomAnalysis: AltiumBomAnalysis | null
}
