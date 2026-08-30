import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

export const TOKEN_STORAGE_KEY = 'fraudshield.token'
export const USER_STORAGE_KEY = 'fraudshield.user'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — the in-memory session still works */
  }
}

/** Called by AuthContext so a 401 anywhere can end the session cleanly. */
let unauthorizedHandler: (() => void) | null = null
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    const isAuthCall = (error.config?.url ?? '').includes('/auth/')
    if (status === 401 && !isAuthCall) {
      setStoredToken(null)
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  },
)

/** Extract a human-readable message from any axios/FastAPI error shape. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot reach the FraudShield API. Make sure the backend is running on port 8000.'
    }
    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Please try again.'
    }

    const data = error.response?.data as
      | { detail?: unknown; errors?: string[]; message?: string }
      | undefined

    const detail = data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | string | undefined
      if (typeof first === 'string') return first
      if (first?.msg) return first.msg
    }
    if (data?.errors?.length) return data.errors[0]
    if (typeof data?.message === 'string') return data.message
    if (error.response?.status === 413) return 'That file is too large.'
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
