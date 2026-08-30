import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Download,
  FileCode2,
  FileText,
  Hash,
  Tags,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { LoadingPanel } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { ScanResultCard, TargetRow } from '@/components/ScanResultCard'
import { ScanTypeIcon } from '@/components/ScanHistoryTable'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { scanService } from '@/services/scanService'
import { reportService } from '@/services/reportService'
import { apiErrorMessage } from '@/services/api'
import { formatBytes, formatDateTime, humanise } from '@/lib/format'
import { SCAN_TYPE_LABEL } from '@/lib/risk'
import type { ScanDetail } from '@/types'

export default function ScanDetails() {
  const { scanId } = useParams<{ scanId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [downloading, setDownloading] = useState<'pdf' | 'html' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [reviewerName, setReviewerName] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [analystNotes, setAnalystNotes] = useState('')
  const [escalationReason, setEscalationReason] = useState('')

  const { data, loading, error } = useAsync<ScanDetail>(
    () => scanService.detail(scanId ?? ''),
    [scanId],
  )

  async function download(format: 'pdf' | 'html') {
    if (!data) return
    setDownloading(format)
    try {
      const filename = await reportService.download(data.scan_id, format)
      toast.success(`Report downloaded — ${filename}`)
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'The report could not be downloaded.'))
    } finally {
      setDownloading(null)
    }
  }

  async function handleTriage(status: ScanDetail['status']) {
    if (!data) return
    setStatusSaving(true)
    try {
      const updated = await scanService.updateStatus(data.scan_id, status, {
        reviewer_name: reviewerName.trim(),
        assigned_to: assignedTo.trim(),
        analyst_notes: analystNotes.trim(),
        escalation_reason: escalationReason.trim(),
      })
      data.status = updated.status
      data.reviewer_name = updated.reviewer_name ?? ''
      data.assigned_to = updated.assigned_to ?? ''
      data.analyst_notes = updated.analyst_notes ?? ''
      data.escalation_reason = updated.escalation_reason ?? ''
      data.status_history = updated.status_history ?? data.status_history
      setReviewerName(updated.reviewer_name ?? '')
      setAssignedTo(updated.assigned_to ?? '')
      setAnalystNotes(updated.analyst_notes ?? '')
      setEscalationReason(updated.escalation_reason ?? '')
      toast.success(`Scan marked as ${status.toLowerCase().replace('_', ' ')}.`)
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'The triage status could not be updated.'))
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleDelete() {
    if (!data) return
    const confirmed = window.confirm(
      `Delete scan #${data.scan_id}? This permanently removes the analysis and its report.`,
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      await scanService.remove(data.scan_id)
      toast.success(`Scan #${data.scan_id} deleted`)
      navigate('/dashboard/history', { replace: true })
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'The scan could not be deleted.'))
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!data) return
    setReviewerName(data.reviewer_name ?? '')
    setAssignedTo(data.assigned_to ?? '')
    setAnalystNotes(data.analyst_notes ?? '')
    setEscalationReason(data.escalation_reason ?? '')
  }, [data])

  if (loading) {
    return (
      <Card>
        <LoadingPanel title="Loading scan analysis…" message="Fetching the full indicator breakdown." />
      </Card>
    )
  }

  if (error || !data) {
    return (
      <div>
        <BackLink />
        <Card className="mt-5">
          <EmptyState
            icon={<TriangleAlert className="h-6 w-6 text-amber-300" aria-hidden />}
            title="Scan not found"
            description={
              error ??
              'This scan does not exist, or it belongs to another account. Return to your history to pick a different one.'
            }
            action={
              <Link
                to="/dashboard/history"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-4 text-[13px] font-medium text-ink transition-colors hover:border-cyan-400/30"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to history
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const analysisEntries = Object.entries(data.analysis_details ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && typeof value !== 'object',
  )

  return (
    <div>
      <BackLink />

      <PageHeader
        className="mt-4"
        eyebrow={`${SCAN_TYPE_LABEL[data.scan_type]} scan · #${data.scan_id}`}
        title={data.target_label}
        description={`Analysed ${formatDateTime(data.created_at)}`}
        icon={<ScanTypeIcon type={data.scan_type} className="h-10 w-10" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => download('pdf')}
              loading={downloading === 'pdf'}
              loadingText="Preparing…"
            >
              <Download className="h-4 w-4" aria-hidden />
              PDF report
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => download('html')}
              loading={downloading === 'html'}
              loadingText="Preparing…"
            >
              <FileCode2 className="h-4 w-4" aria-hidden />
              HTML
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleTriage('REVIEWED')}
              loading={statusSaving}
            >
              Mark reviewed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTriage('ESCALATED')}
              loading={statusSaving}
            >
              Escalate
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Status
        </span>
        <Badge tone={data.status === 'REVIEWED' ? 'success' : data.status === 'ESCALATED' ? 'warning' : data.status === 'DISMISSED' ? 'danger' : 'neutral'}>
          {data.status}
        </Badge>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Analyst case notes"
          subtitle="Capture the investigator decision for this scan"
          icon={<FileText className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="space-y-4 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Reviewer name"
              value={reviewerName}
              onChange={(event) => setReviewerName(event.target.value)}
              placeholder="Analyst name"
            />
            <Input
              label="Assigned analyst"
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              placeholder="Analyst B"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-ink-muted">
              Escalation reason
            </label>
            <select
              value={escalationReason}
              onChange={(event) => setEscalationReason(event.target.value)}
              className="h-11 w-full rounded-xl border border-hairline bg-abyss/80 px-3.5 text-sm text-ink outline-none transition-colors focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
            >
              <option value="">No escalation reason</option>
              <option value="Brand impersonation">Brand impersonation</option>
              <option value="Credential harvesting">Credential harvesting</option>
              <option value="Urgent account takeover risk">Urgent account takeover risk</option>
              <option value="Manual confirmation required">Manual confirmation required</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-ink-muted">
              Analyst notes
            </label>
            <textarea
              value={analystNotes}
              onChange={(event) => setAnalystNotes(event.target.value)}
              rows={5}
              placeholder="Document why this case was reviewed or escalated."
              className="w-full rounded-xl border border-hairline bg-abyss/80 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint/70 outline-none transition-colors focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
            />
          </div>

          {data.status_history?.length ? (
            <div>
              <label className="mb-2 block text-xs font-medium tracking-wide text-ink-muted">
                Case timeline
              </label>
              <div className="space-y-2">
                {data.status_history.slice().reverse().map((entry, index) => (
                  <div key={`${entry.changed_at ?? index}-${index}`} className="rounded-xl border border-hairline bg-surface-2/50 px-3 py-2 text-sm text-ink-muted">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      <span>{entry.status}</span>
                      {entry.assigned_to ? <span>• {entry.assigned_to}</span> : null}
                    </div>
                    <div className="mt-1">
                      {entry.reviewer_name ? `Reviewer: ${entry.reviewer_name}` : 'Reviewer: unassigned'}
                    </div>
                    {entry.escalation_reason ? (
                      <div className="mt-1 text-ink">Escalation: {entry.escalation_reason}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleTriage('REVIEWED')}
              loading={statusSaving}
            >
              Save reviewed state
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTriage('ESCALATED')}
              loading={statusSaving}
            >
              Save escalation
            </Button>
          </div>
        </CardBody>
      </Card>

      {data.user && (
        <Alert tone="info" className="mb-5" title="Administrator view">
          Submitted by <span className="font-medium">{data.user.name}</span> ({data.user.email}) ·
          role {data.user.role}
        </Alert>
      )}

      <ScanResultCard
        scanId={data.scan_id}
        score={data.risk_score}
        level={data.risk_level}
        prediction={data.prediction}
        confidence={data.confidence}
        explanation={data.explanation}
        recommendation={data.recommendation}
        indicators={data.indicators}
        disclaimer={data.disclaimer}
        showDetailLink={false}
        target={<TargetBlock scan={data} />}
      >
        {/* Modality extras */}
        {Boolean(data.detected_categories?.length || data.suspicious_phrases?.length) && (
          <div className="grid gap-5 lg:grid-cols-2">
            {data.detected_categories?.length ? (
              <Card>
                <CardHeader
                  title="Detected scam categories"
                  icon={<Tags className="h-4 w-4" aria-hidden />}
                />
                <CardBody>
                  <div className="flex flex-wrap gap-2">
                    {data.detected_categories.map((category) => (
                      <Badge key={category} tone="warning">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {data.suspicious_phrases?.length ? (
              <Card>
                <CardHeader
                  title="Suspicious phrases found"
                  icon={<TriangleAlert className="h-4 w-4" aria-hidden />}
                />
                <CardBody>
                  <ul className="space-y-1.5">
                    {data.suspicious_phrases.slice(0, 15).map((phrase) => (
                      <li
                        key={phrase}
                        className="rounded-lg border border-hairline bg-surface-2/50 px-2.5 py-1.5 font-mono text-[12px] text-amber-200"
                      >
                        “{phrase}”
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
          </div>
        )}

        {data.scan_type === 'MESSAGE' && data.message && (
          <Card>
            <CardHeader
              title="Full message text"
              subtitle="Exactly as submitted"
              icon={<FileText className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-hairline bg-abyss/60 p-4 text-[13px] leading-relaxed text-ink-muted">
                {data.message}
              </p>
            </CardBody>
          </Card>
        )}

        {data.scan_type === 'DOCUMENT' && (
          <Card>
            <CardHeader
              title="Extracted text"
              subtitle={
                data.ocr_available
                  ? 'Text read from the document'
                  : 'OCR was unavailable — metadata-only analysis'
              }
              icon={<FileText className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              {data.extracted_text?.trim() ? (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-hairline bg-abyss/60 p-4 font-mono text-[12px] leading-relaxed text-ink-muted scrollbar-none">
                  {data.extracted_text}
                </pre>
              ) : (
                <p className="text-[13px] text-ink-muted">
                  No text was extracted from this document. Scoring used metadata, structure and
                  file characteristics.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {data.scan_type === 'DOCUMENT' && Object.keys(data.document_metadata ?? {}).length > 0 && (
          <Card>
            <CardHeader
              title="Document metadata"
              icon={<Hash className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {Object.entries(data.document_metadata ?? {}).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 border-b border-hairline/40 py-1.5"
                  >
                    <dt className="text-[12px] text-ink-faint">{humanise(key)}</dt>
                    <dd className="max-w-[55%] break-words text-right font-mono text-[12px] text-ink-muted">
                      {value === null || value === undefined || value === '' ? '—' : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        )}

        {analysisEntries.length > 0 && (
          <Card>
            <CardHeader
              title="Technical analysis details"
              subtitle="Raw values recorded by the detection engine"
              icon={<FileCode2 className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {analysisEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 border-b border-hairline/40 py-1.5"
                  >
                    <dt className="text-[12px] text-ink-faint">{humanise(key)}</dt>
                    <dd className="max-w-[55%] break-words text-right font-mono text-[12px] text-ink-muted">
                      {typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Scan record"
            subtitle="Audit metadata for this analysis"
            icon={<Clock className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <Row label="Scan ID" value={`#${data.scan_id}`} />
              <Row label="Type" value={SCAN_TYPE_LABEL[data.scan_type]} />
              <Row label="Status" value={data.status} />
              <Row label="Created" value={formatDateTime(data.created_at)} />
              <Row label="Risk score" value={`${data.risk_score.toFixed(1)} / 100`} />
              <Row label="Risk level" value={data.risk_level} />
              <Row label="Confidence" value={`${data.confidence.toFixed(0)}%`} />
              <Row label="Indicators" value={String(data.indicators.length)} />
            </dl>
          </CardBody>
        </Card>
      </ScanResultCard>
    </div>
  )
}

function TargetBlock({ scan }: { scan: ScanDetail }) {
  if (scan.scan_type === 'URL') {
    return <TargetRow label="Analysed URL" value={scan.url ?? scan.target_label} copyable mono />
  }
  if (scan.scan_type === 'DOCUMENT') {
    return (
      <div className="space-y-2.5">
        <TargetRow label="File name" value={scan.filename ?? scan.target_label} />
        <div className="grid grid-cols-2 gap-2.5">
          <TargetRow label="Type" value={(scan.file_type ?? '—').toUpperCase()} />
          <TargetRow label="Size" value={formatBytes(scan.file_size)} />
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-hairline bg-abyss/60 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
        Analysed message
      </p>
      <p className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink scrollbar-none">
        {scan.message ?? scan.target_label}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline/40 py-1.5">
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="text-right font-mono text-[12px] text-ink-muted">{value}</dd>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/dashboard/history"
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-cyan-300"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to scan history
    </Link>
  )
}
