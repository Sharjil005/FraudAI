import { api } from './api'
import type { AdminAnalytics, DashboardSummary } from '@/types'

export const dashboardService = {
  async summary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary')
    return data
  },

  async adminAnalytics(): Promise<AdminAnalytics> {
    const { data } = await api.get<AdminAnalytics>('/admin/analytics')
    return data
  },
}
