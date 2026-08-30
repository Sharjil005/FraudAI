import { api } from './api'
import type { TokenResponse, User } from '@/types'

export interface RegisterPayload {
  name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export const authService = {
  async register(payload: RegisterPayload): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/register', payload)
    return data
  },

  async login(payload: LoginPayload): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/login', payload)
    return data
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me')
    return data
  },
}
