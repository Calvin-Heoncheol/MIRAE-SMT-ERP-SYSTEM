/** 생산현황(총관리자)에서 등록한 SMT·후공정·출하 이력 비고 */
export const ADMIN_DIRECT_PRODUCTION_NOTE = '생산실사(관리자)'

export function isAdminDirectProductionNote(note: string | null | undefined) {
  return String(note || '').trim() === ADMIN_DIRECT_PRODUCTION_NOTE
}
