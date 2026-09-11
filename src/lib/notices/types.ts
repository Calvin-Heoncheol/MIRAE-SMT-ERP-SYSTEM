export type CompanyNotice = {
  id: string
  title: string
  body: string
  isPinned: boolean
  createdByName: string
  createdAt: string
  updatedAt: string
}

export type UpsertCompanyNoticeInput = {
  id?: string
  title: string
  body: string
  isPinned: boolean
}

export const NOTICE_TITLE_MAX = 80
export const NOTICE_BODY_MAX = 2000
export const NOTICE_HOME_LIMIT = 30
