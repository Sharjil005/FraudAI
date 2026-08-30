import { api } from './api'
import type { User } from '@/types'

export const adminService = {
  async users(): Promise<User[]> {
    const { data } = await api.get<User[]>('/admin/users')
    return data
  },

  async setUserStatus(userId: number, isActive: boolean): Promise<User> {
    const { data } = await api.patch<User>(
      `/admin/users/${userId}/status`,
      undefined,
      { params: { is_active: isActive } },
    )
    return data
  },

  async retrainModels(): Promise<Record<string, unknown>> {
    const { data } = await api.post<Record<string, unknown>>('/admin/model/retrain')
    return data
  },
}
