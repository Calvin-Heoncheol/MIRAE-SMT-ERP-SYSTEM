const STORAGE_PREFIX = 'mirae-erp-notif-reads:'

export function notificationReadsStorageKey(userId: string | null | undefined) {
  return `${STORAGE_PREFIX}${userId?.trim() || 'anonymous'}`
}

export function loadReadNotificationKeys(userId: string | null | undefined): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(notificationReadsStorageKey(userId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

export function saveReadNotificationKeys(
  userId: string | null | undefined,
  keys: Set<string>,
) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      notificationReadsStorageKey(userId),
      JSON.stringify([...keys]),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function markNotificationsRead(
  userId: string | null | undefined,
  keys: string[],
) {
  const next = loadReadNotificationKeys(userId)
  for (const key of keys) next.add(key)
  saveReadNotificationKeys(userId, next)
  return next
}
