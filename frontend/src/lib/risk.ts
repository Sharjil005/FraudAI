import type { RiskLevel, ScanType, Severity } from '@/types'

export const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export const RISK_BANDS: Record<RiskLevel, string> = {
  LOW: '0 – 29',
  MEDIUM: '30 – 59',
  HIGH: '60 – 79',
  CRITICAL: '80 – 100',
}

interface RiskTheme {
  label: string
  hex: string
  text: string
  bg: string
  border: string
  ring: string
  gradient: string
  headline: string
}

export const RISK_THEME: Record<RiskLevel, RiskTheme> = {
  LOW: {
    label: 'Low Risk',
    hex: '#22c55e',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/30',
    gradient: 'from-emerald-400 to-teal-500',
    headline: 'No meaningful fraud signals found',
  },
  MEDIUM: {
    label: 'Medium Risk',
    hex: '#f59e0b',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/30',
    gradient: 'from-amber-300 to-orange-500',
    headline: 'Some suspicious characteristics detected',
  },
  HIGH: {
    label: 'High Risk',
    hex: '#f97316',
    text: 'text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/35',
    ring: 'ring-orange-500/30',
    gradient: 'from-orange-400 to-rose-500',
    headline: 'Strong fraud indicators detected',
  },
  CRITICAL: {
    label: 'Critical Risk',
    hex: '#ef4444',
    text: 'text-red-300',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    ring: 'ring-red-500/30',
    gradient: 'from-red-400 to-fuchsia-600',
    headline: 'Severe fraud pattern detected',
  },
}

export const SEVERITY_THEME: Record<Severity, { label: string; className: string }> = {
  info: { label: 'Info', className: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  low: { label: 'Low', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  medium: { label: 'Medium', className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  high: { label: 'High', className: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
  critical: { label: 'Critical', className: 'text-red-300 bg-red-500/10 border-red-500/40' },
}

export const SCAN_TYPE_LABEL: Record<ScanType, string> = {
  URL: 'URL',
  MESSAGE: 'Message',
  DOCUMENT: 'Document',
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 30) return 'MEDIUM'
  return 'LOW'
}

export function riskTheme(level: RiskLevel | undefined): RiskTheme {
  return RISK_THEME[level ?? 'LOW']
}

export function severityTheme(severity: Severity | string) {
  return SEVERITY_THEME[(severity as Severity) in SEVERITY_THEME ? (severity as Severity) : 'info']
}
