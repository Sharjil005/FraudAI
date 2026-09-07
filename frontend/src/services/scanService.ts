import { api } from './api'
import type {
  Capabilities,
  DocumentScanResult,
  MessageScanResult,
  QrScanResult,
  ScanDetail,
  ScanHistoryQuery,
  ScanListResponse,
  UrlScanResult,
} from '@/types'

export const scanService = {
  async scanUrl(url: string): Promise<UrlScanResult> {
    const { data } = await api.post<UrlScanResult>('/scan/url', { url })
    return data
  },

  async scanMessage(message: string): Promise<MessageScanResult> {
    const { data } = await api.post<MessageScanResult>('/scan/message', { message })
    return data
  },

  async scanDocument(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<DocumentScanResult> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post<DocumentScanResult>('/scan/document', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      },
    })
    return data
  },

  async scanQr(options: {
    file?: File
    payload?: string
    claimed_intent?: 'GENERAL_SCAN' | 'RECEIVE_MONEY' | 'SEND_MONEY'
    onProgress?: (percent: number) => void
  }): Promise<QrScanResult> {
    if (options.file) {
      const form = new FormData()
      form.append('file', options.file)
      if (options.claimed_intent) {
        form.append('claimed_intent', options.claimed_intent)
      }
      const { data } = await api.post<QrScanResult>('/scan/qr/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (options.onProgress && event.total) {
            options.onProgress(Math.round((event.loaded / event.total) * 100))
          }
        },
      })
      return data
    }

    const { data } = await api.post<QrScanResult>('/scan/qr', {
      payload: options.payload,
      claimed_intent: options.claimed_intent ?? 'GENERAL_SCAN',
    })
    return data
  },

  async history(query: ScanHistoryQuery = {}): Promise<ScanListResponse> {
    const params: Record<string, string | number> = {
      page: query.page ?? 1,
      page_size: query.page_size ?? 10,
    }
    if (query.scan_type) params.scan_type = query.scan_type
    if (query.risk_level) params.risk_level = query.risk_level
    if (query.search?.trim()) params.search = query.search.trim()

    const { data } = await api.get<ScanListResponse>('/scans', { params })
    return data
  },

  async detail(scanId: number | string): Promise<ScanDetail> {
    const { data } = await api.get<ScanDetail>(`/scans/${scanId}`)
    return data
  },

  async updateStatus(
    scanId: number,
    status: ScanDetail['status'],
    metadata?: {
      reviewer_name?: string
      assigned_to?: string
      analyst_notes?: string
      escalation_reason?: string
    },
  ): Promise<ScanDetail> {
    const { data } = await api.patch<ScanDetail>(`/scans/${scanId}/status`, {
      status,
      ...metadata,
    })
    return data
  },

  async bulkUpdateStatus(
    scanIds: number[],
    status: ScanDetail['status'],
    metadata?: {
      reviewer_name?: string
      assigned_to?: string
      analyst_notes?: string
      escalation_reason?: string
    },
  ): Promise<{ updated: number; items: ScanDetail[] }> {
    const { data } = await api.patch<{ updated: number; items: ScanDetail[] }>(`/scans/bulk-status`, {
      scan_ids: scanIds,
      status,
      ...metadata,
    })
    return data
  },

  async remove(scanId: number): Promise<void> {
    await api.delete(`/scans/${scanId}`)
  },

  async capabilities(): Promise<Capabilities> {
    const { data } = await api.get<Capabilities>('/scan/capabilities')
    return data
  },
}
