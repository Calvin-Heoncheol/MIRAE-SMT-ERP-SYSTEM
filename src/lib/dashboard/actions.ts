'use server'

import { fetchHomeTeamProduction } from '@/lib/dashboard/home-data'

export async function loadHomeTeamProductionAction(recordDate: string) {
  return fetchHomeTeamProduction(recordDate)
}
