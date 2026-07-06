export type SmtProductionPlan = {
  id: string
  orderId: string
  plannedDate: string
  lineNo: number
  plannedQuantity: number
  note: string
  createdAt: string
}

export type SmtPlanOrderCandidate = {
  orderId: string
  orderNumber: string
  customer: string
  productSummary: string
  deliveryDate: string
  smtTarget: number
  smtProduced: number
  smtRemaining: number
  plannedTotal: number
  unplannedRemaining: number
  daysUntilDelivery: number | null
}

export type SmtPlanBlock = SmtProductionPlan & {
  orderNumber: string
  customer: string
  productSummary: string
  deliveryDate: string
}

export type SmtPlanPageData = {
  weekStart: string
  weekDates: string[]
  lineNos: number[]
  plans: SmtPlanBlock[]
  unassignedOrders: SmtPlanOrderCandidate[]
}

export type UpsertSmtProductionPlanInput = {
  id?: string
  orderId: string
  plannedDate: string
  lineNo: number
  plannedQuantity: number
  note?: string
}
