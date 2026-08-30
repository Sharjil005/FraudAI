import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Copy,
  Download,
  FileText,
  Lightbulb,
  ListChecks,
  ShieldQuestion,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RiskMeter, RiskScale } from '@/components/RiskMeter'
import { IndicatorList } from '@/components/IndicatorList'
import { useToast } from '@/components/ui/Toast'
import { reportService } from '@/services/reportService'
import { apiErrorMessage } from '@/services/api'
import { riskTheme } from '@/lib/risk'
import { cn } from '@/lib/cn'
import type { Indicator, RiskLevel } from '@/types'

export interface ScanResultCardProps {
  scanId: number
  score: number
  level: RiskLevel
  prediction: string
  confidence: number
  explanation: string
  recommendation: string
  indicators: Indicator[]
  /** Modality-specific detail block (the URL, the message text, the file card…). */
  target: ReactNode
  /** Extra sections rendered under the indicators (categories, metadata…). */
  children?: ReactNode
  disclaimer?: string
  showDetailLink?: boolean
  className?: string
}

export function ScanResultCard({
  scanId,
  score,
  level,
  prediction,
  confidence,
  explanation,
  recommendation,
  indicators,
  target,
  children,
  disclaimer,
  showDetailLink = true,
  className,
}: ScanResultCardProps) {
  const theme = riskTheme(level)
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const filename = await reportService.download(scanId, 'pdf')
      toast.success(`Report downloaded — ${filename}`)
    } catch (error) {
      toast.error(apiErrorMessage(error, 'The report could not be downloaded.'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={cn('space-y-5 animate-fade-up', className)}>
      {/* Verdict banner */}
      <Card className={cn('overflow-hidden border', theme.border)}>
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${theme.hex}, ${theme.hex}22)` }}
        />
        <CardBody className="grid gap-6 p-6 lg:grid-cols-[auto_1fr] lg:items-center">
          <RiskMeter
            score={score}
            level={level}
            prediction={prediction}
            confidence={confidence}
          />

          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                Verdict
              </p>
              <h2 className={cn('mt-1 text-xl font-semibold sm:text-2xl', theme.text)}>
                {prediction} · {theme.label}
              </h2>
              <p className="mt-1 text-xs text-ink-faint">{theme.headline}</p>
            </div>

            {target}

            <RiskScale score={score} />

            <div className="flex flex-wrap gap-2.5 pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDownload}
                loading={downloading}
                loadingText="Preparing report…"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download report
              </Button>
              {showDetailLink && (
                <Link
                  to={`/dashboard/scans/${scanId}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
                >
                  Full analysis
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Explanation + recommendation */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Why this result?"
            subtitle="Plain-language explanation of the analysis"
            icon={<ShieldQuestion className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            <p className="text-[13px] leading-relaxed text-ink-muted">{explanation}</p>
          </CardBody>
        </Card>

        <Card className={cn('border', theme.border)}>
          <CardHeader
            title="What you should do"
            subtitle="Recommended next step"
            icon={<Lightbulb className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            <p className={cn('text-[13px] font-medium leading-relaxed', theme.text)}>
              {recommendation}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Indicators */}
      <Card>
        <CardHeader
          title="Contributing risk indicators"
          subtitle={`${indicators.filter((item) => item.weight > 0).length} signal(s) influenced this score`}
          icon={<ListChecks className="h-4 w-4" aria-hidden />}
        />
        <CardBody>
          <IndicatorList indicators={indicators} />
        </CardBody>
      </Card>

      {children}

      {disclaimer && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-100/90">{disclaimer}</p>
        </div>
      )}
    </div>
  )
}

/** Small labelled row used inside the target blocks. */
export function TargetRow({
  label,
  value,
  copyable = false,
  mono = false,
}: {
  label: string
  value: string
  copyable?: boolean
  mono?: boolean
}) {
  const toast = useToast()

  return (
    <div className="rounded-xl border border-hairline bg-abyss/60 px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          {label}
        </p>
        {copyable && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(value)
                .then(() => toast.success('Copied to clipboard'))
                .catch(() => toast.error('Could not copy to clipboard'))
            }}
            className="rounded-md p-1 text-ink-faint transition hover:bg-white/5 hover:text-ink"
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
      <p
        className={cn(
          'mt-1 break-all text-[13px] text-ink',
          mono && 'font-mono text-[12px] leading-relaxed',
        )}
      >
        {value}
      </p>
    </div>
  )
}
