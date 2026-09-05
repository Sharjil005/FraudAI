import { api } from './api'
import type { Friendship, User, SafetyGroup, ThreatAlert } from '@/types'

export interface ShareAlertPayload {
  scan_id: number
  friend_ids: number[]
  group_ids: number[]
  note: string
}

export const socialService = {
  async sendFriendRequest(email: string): Promise<Friendship> {
    const { data } = await api.post<Friendship>('/social/friends/request', { email })
    return data
  },

  async getPendingRequests(): Promise<Friendship[]> {
    const { data } = await api.get<Friendship[]>('/social/friends/requests')
    return data
  },

  async acceptFriendRequest(requestId: number): Promise<Friendship> {
    const { data } = await api.post<Friendship>(`/social/friends/accept/${requestId}`)
    return data
  },

  async rejectFriendRequest(requestId: number): Promise<Friendship> {
    const { data } = await api.post<Friendship>(`/social/friends/reject/${requestId}`)
    return data
  },

  async getFriends(): Promise<User[]> {
    const { data } = await api.get<User[]>('/social/friends')
    return data
  },

  async removeFriend(friendshipId: number): Promise<void> {
    await api.delete(`/social/friends/${friendshipId}`)
  },

  async createGroup(name: string): Promise<SafetyGroup> {
    const { data } = await api.post<SafetyGroup>('/social/groups', { name })
    return data
  },

  async getGroups(): Promise<SafetyGroup[]> {
    const { data } = await api.get<SafetyGroup[]>('/social/groups')
    return data
  },

  async addGroupMember(groupId: number, friendId: number): Promise<User> {
    const { data } = await api.post<User>(`/social/groups/${groupId}/members`, { friend_id: friendId })
    return data
  },

  async removeGroupMember(groupId: number, memberUserId: number): Promise<void> {
    await api.delete(`/social/groups/${groupId}/members/${memberUserId}`)
  },

  async deleteGroup(groupId: number): Promise<void> {
    await api.delete(`/social/groups/${groupId}`)
  },

  async shareThreatAlert(payload: ShareAlertPayload): Promise<{ message: string; shared_count: number }> {
    const { data } = await api.post<{ message: string; shared_count: number }>('/social/share', payload)
    return data
  },

  async getThreatAlerts(unreadOnly: boolean = false): Promise<ThreatAlert[]> {
    const { data } = await api.get<ThreatAlert[]>('/social/alerts', {
      params: { unread_only: unreadOnly },
    })
    return data
  },

  async markAlertAsRead(alertId: number): Promise<ThreatAlert> {
    const { data } = await api.post<ThreatAlert>(`/social/alerts/${alertId}/read`)
    return data
  },
}
