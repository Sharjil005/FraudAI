/**
 * API contract types — these mirror the FastAPI Pydantic schemas exactly.
 * Enum values are uppercase on the wire (RiskLevel, ScanType, UserRole).
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ScanType = 'URL' | 'MESSAGE' | 'DOCUMENT'
export type ScanStatus = 'PENDING' | 'COMPLETED' | 'FAILED'
export type UserRole = 'USER' | 'ADMIN'
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface Indicator {
  code: string
  label: string
  detail: string
  severity: Severity
  weight: number
}

export interface RiskAssessment {
  overall_score: number
  risk_level: RiskLevel
  prediction: string
  confidence: number
  recommendation: string
  explanation: string
  module_scores?: Record<string, number>
}

export interface ScanEnvelope {
  scan_id: number
  scan_type: ScanType
  status: ScanStatus
  created_at: string
  target_label: string
}

interface ScanResultBase {
  scan: ScanEnvelope
  prediction: string
  risk_score: number
  risk_level: RiskLevel
  confidence: number
  indicators: Indicator[]
  explanation: string
  recommendation: string
  risk_assessment: RiskAssessment
  analysis_details: Record<string, unknown>
}

export interface UrlScanResult extends ScanResultBase {
  url: string
  normalised_url: string
}

export interface MessageScanResult extends ScanResultBase {
  message: string
  detected_categories: string[]
  suspicious_phrases: string[]
}

export interface DocumentScanResult extends ScanResultBase {
  filename: string
  file_type: string
  file_size: number
  extracted_text: string | null
  extracted_text_truncated?: boolean
  ocr_available: boolean
  ocr_used?: boolean
  metadata: Record<string, unknown>
  disclaimer: string
}

export type AnyScanResult = UrlScanResult | MessageScanResult | DocumentScanResult

export interface ScanListItem {
  scan_id: number
  scan_type: ScanType
  status: ScanStatus
  created_at: string
  target_label: string
  prediction: string
  risk_score: number
  risk_level: RiskLevel
  indicator_count: number
}

export interface PaginatedMeta {
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ScanListResponse {
  items: ScanListItem[]
  meta: PaginatedMeta
}

export interface ScanDetail {
  scan_id: number
  scan_type: ScanType
  status: ScanStatus
  created_at: string
  target_label: string
  prediction: string
  risk_score: number
  risk_level: RiskLevel
  confidence: number
  explanation: string
  recommendation: string
  indicators: Indicator[]
  analysis_details: Record<string, unknown>
  url?: string
  message?: string
  detected_categories?: string[]
  suspicious_phrases?: string[]
  filename?: string
  file_type?: string
  file_size?: number
  extracted_text?: string | null
  ocr_available?: boolean
  document_metadata?: Record<string, unknown>
  disclaimer?: string
  user?: { id: number; name: string; email: string; role: string }
}

export interface StatCard {
  key: string
  label: string
  value: number
  unit?: string | null
  delta?: number | null
  hint?: string | null
}

export interface RiskDistributionItem {
  risk_level: RiskLevel
  count: number
  percentage: number
}

export interface ScanTypeCount {
  scan_type: ScanType
  count: number
  percentage: number
}

export interface ScanTrendPoint {
  date: string
  total: number
  safe: number
  suspicious: number
  high_risk: number
}

export interface DashboardSummary {
  generated_at: string
  total_scans: number
  threats_detected: number
  high_risk_scans: number
  safe_scans: number
  average_risk_score: number
  detection_rate: number
  stats: StatCard[]
  risk_distribution: RiskDistributionItem[]
  scan_type_distribution: ScanTypeCount[]
  trend: ScanTrendPoint[]
  top_indicators: TopIndicator[]
  recent_scans: ScanListItem[]
}

export interface AdminUserRow {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  scan_count: number
  high_risk_count: number
}

export interface TopIndicator {
  code: string
  label: string
  count: number
}

export interface AdminAnalytics {
  generated_at: string
  total_users: number
  total_admins: number
  new_users_last_7_days: number
  total_scans: number
  fraud_detections: number
  high_risk_percentage: number
  average_risk_score: number
  stats: StatCard[]
  risk_distribution: RiskDistributionItem[]
  scan_type_distribution: ScanTypeCount[]
  trend: ScanTrendPoint[]
  top_indicators: TopIndicator[]
  recent_suspicious_scans: ScanListItem[]
  users: AdminUserRow[]
  model_status: Record<string, unknown>
}

export interface Capabilities {
  models: Record<string, unknown>
  ocr: { engine: string; available: boolean; version: string | null; fallback: string | null }
  uploads: { allowed_extensions: string[]; max_size_mb: number }
  risk_bands: Record<string, string>
}

export interface ScanHistoryQuery {
  page?: number
  page_size?: number
  scan_type?: ScanType | ''
  risk_level?: RiskLevel | ''
  search?: string
}
