'use server'

import { getAuthProfile } from '@/lib/auth/session'
import { fetchActivityNotificationFeed } from '@/lib/notifications/repository'
import type { ActivityNotificationFeed } from '@/lib/notifications/types'

export async function loadActivityNotificationFeedAction(): Promise<ActivityNotificationFeed> {
  const profile = await getAuthProfile()
  return fetchActivityNotificationFeed(profile)
}
