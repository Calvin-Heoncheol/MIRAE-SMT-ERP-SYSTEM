'use server'

import { getAuthProfile } from '@/lib/auth/session'
import { fetchNotificationFeed } from '@/lib/notifications/repository'
import type { NotificationFeed } from '@/lib/notifications/types'

export async function loadNotificationFeedAction(): Promise<NotificationFeed> {
  const profile = await getAuthProfile()
  return fetchNotificationFeed(profile)
}
