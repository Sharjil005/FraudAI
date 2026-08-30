import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  FileImage,
  FileText,
  FileWarning,
  Radar,
  ScanEye,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { LoadingPanel } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/PageHeader'
import { ScanResultCard, TargetRow } from '@/components/ScanResultCard'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { scanService } from '@/services/scanService'
import { apiErrorMessage } from '@/services/api'
import { cn } from '@/lib/cn'
import { formatBytes, humanise } from '@/lib/format'
import type { Capabilities, DocumentScanResult } from '@/types'

const FALLBACK_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf']
const FALLBACK_MAX_MB = 10

const CHECKLIST = [
  'Fraud and urgency language inside the extracted text',
  'Payment redirection and unexpected account-detail changes',
  'Invoice / receipt structure completeness',
  'Producer and creator metadata anomalies',
  'Suspicious links or contact channels embedded in the document',
  'File-type, size and naming irregularities',
]

export default function DocumentScanner() {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  const { data: capabilities } = useAsync<Capabilities>(() => scanService.capabilities(), [])

  const allowed = capabilities?.uploads.allowed_extensions ?? FALLBACK_EXTENSIONS
  const maxMb = capabilities?.uploads.max_size_mb ?? FALLBACK_MAX_MB
  const ocrAvailable = capabilities?.ocr.available ?? false

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DocumentScanResult | null>(null)

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const validate = useCallback(
    (candidate: File): string | null => {
      const extension = candidate.name.split('.').pop()?.toLowerCase() ?? ''
      if (!allowed.includes(extension)) {
        return `Unsupported file type “.${extension || 'unknown'}”. Allowed: ${allowed
          .map((item) => `.${item}`)
          .join(', ')}.`
      }
      if (candidate.size > maxMb * 1024 * 1024) {
        return `That file is ${formatBytes(candidate.size)} — the limit is ${maxMb} MB.`
      }
      if (candidate.size === 0) return 'That file is empty.'
      return null
    },
    [allowed, maxMb],
  )

  function accept(candidate: File | undefined) {
    if (!candidate) return
    const problem = validate(candidate)
    if (problem) {
      setError(problem)
      setFile(null)
      return
    }
    setError(null)
    setResult(null)
    setFile(candidate)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    accept(event.dataTransfer.files?.[0])
  }

  async function handleAnalyse() {
    if (!file) {
      setError('Choose a document to analyse.')
      return
    }
    setScanning(true)
    setError(null)
    setResult(null)
    setProgress(0)
    try {
      const data = await scanService.scanDocument(file, setProgress)
      setResult(data)
      toast.push(`Analysis complete — ${data.prediction} (${data.risk_level})`, 'info')
    } catch (caught) {
      setError(apiErrorMessage(caught, 'The document could not be analysed.'))
    } finally {
      setScanning(false)
      setProgress(0)
    }
  }

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const FileIcon = file?.type.startsWith('image/') ? FileImage : FileText

  return (
    <div>
      <PageHeader
        eyebrow="Document Scanner"
        title="Suspicious document risk assessment"
        description="Upload an invoice, receipt, screenshot or PDF. FraudShield extracts what it can, then flags potential anomalies for manual verification."
        icon={<ScanEye className="h-5 w-5" aria-hidden />}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Upload a document"
              subtitle={`${allowed.map((item) => `.${item}`).join(', ')} · up to ${maxMb} MB`}
              icon={<Upload className="h-4 w-4" aria-hidden />}
            />
            <CardBody className="space-y-4 pt-5">
              <div
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'relative rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  dragging
                    ? 'border-cyan-400/70 bg-cyan-400/8'
                    : 'border-hairline bg-abyss/40 hover:border-cyan-400/35',
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={allowed.map((item) => `.${item}`).join(',')}
                  onChange={(event) => accept(event.target.files?.[0])}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Choose a document to analyse"
                  disabled={scanning}
                />
                <span className="pointer-events-none mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                  <Upload className="h-6 w-6" aria-hidden />
                </span>
                <p className="pointer-events-none mt-4 text-[14px] font-medium text-ink">
                  Drag &amp; drop a file here, or click to browse
                </p>
                <p className="pointer-events-none mt-1 text-[12px] text-ink-faint">
                  {allowed.map((item) => item.toUpperCase()).join(' · ')} — max {maxMb} MB
                </p>
              </div>

              {file && (
                <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-2/60 px-4 py-3 animate-fade-in">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-pink-400/25 bg-pink-400/10 text-pink-300">
                    <FileIcon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{file.name}</p>
                    <p className="text-[11px] text-ink-faint">
                      {formatBytes(file.size)} · {file.type || 'unknown type'}
                    </p>
                  </div>
                  {!scanning && (
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-red-500/10 hover:text-red-300"
                      aria-label="Remove selected file"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              )}

              {scanning && progress > 0 && progress < 100 && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-ink-faint">
                    <span>Uploading</span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                <Button
                  type="button"
                  onClick={handleAnalyse}
                  disabled={!file}
                  loading={scanning}
                  loadingText="Extracting document intelligence…"
                >
                  <Radar className="h-4 w-4" aria-hidden />
                  Analyse document
                </Button>
                {(file || result) && !scanning && (
                  <Button type="button" variant="ghost" onClick={reset}>
                    Clear
                  </Button>
                )}
              </div>

              {!ocrAvailable && (
                <Alert tone="info" title="OCR engine not detected">
                  Tesseract is not installed on this machine, so text extraction is unavailable.
                  Analysis still runs on file metadata, structure and naming — you will get a
                  meaningful risk assessment, just without the text-based indicators. Install
                  Tesseract OCR to unlock full extraction.
                </Alert>
              )}
            </CardBody>
          </Card>

          <div ref={resultRef}>
            {scanning && (
              <Card>
                <LoadingPanel
                  title="Extracting document intelligence…"
                  message="Reading metadata, attempting text extraction and matching document-fraud heuristics."
                />
              </Card>
            )}

            {!scanning && result && (
              <ScanResultCard
                scanId={result.scan.scan_id}
                score={result.risk_score}
                level={result.risk_level}
                prediction={result.prediction}
                confidence={result.confidence}
                explanation={result.explanation}
                recommendation={result.recommendation}
                indicators={result.indicators}
                disclaimer={result.disclaimer}
                target={
                  <div className="space-y-2.5">
                    <TargetRow label="File name" value={result.filename} />
                    <div className="grid grid-cols-2 gap-2.5">
                      <TargetRow label="Type" value={result.file_type.toUpperCase()} />
                      <TargetRow label="Size" value={formatBytes(result.file_size)} />
                    </div>
                  </div>
                }
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader
                      title="Extracted text"
                      subtitle={
                        result.ocr_used
                          ? 'Read from the document via OCR'
                          : result.ocr_available
                            ? 'OCR available but no readable text was found'
                            : 'OCR unavailable — metadata-only analysis'
                      }
                      icon={<FileText className="h-4 w-4" aria-hidden />}
                      action={
                        <Badge tone={result.ocr_used ? 'success' : 'neutral'}>
                          {result.ocr_used ? 'OCR used' : 'No text layer'}
                        </Badge>
                      }
                    />
                    <CardBody>
                      {result.extracted_text?.trim() ? (
                        <>
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-hairline bg-abyss/60 p-3.5 font-mono text-[12px] leading-relaxed text-ink-muted scrollbar-none">
                            {result.extracted_text}
                          </pre>
                          {result.extracted_text_truncated && (
                            <p className="mt-2 text-[11px] text-ink-faint">
                              Output truncated for display. The full text was used for scoring.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[13px] leading-relaxed text-ink-muted">
                          No text could be extracted from this file. The risk assessment below is
                          based on metadata, structure and file characteristics only.
                        </p>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader
                      title="Document metadata"
                      subtitle="Properties read from the file itself"
                      icon={<FileWarning className="h-4 w-4" aria-hidden />}
                    />
                    <CardBody>
                      {Object.keys(result.metadata ?? {}).length ? (
                        <dl className="divide-y divide-hairline/50">
                          {Object.entries(result.metadata).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0"
                            >
                              <dt className="text-[12px] text-ink-faint">{humanise(key)}</dt>
                              <dd className="max-w-[55%] break-words text-right font-mono text-[12px] text-ink-muted">
                                {value === null || value === undefined || value === ''
                                  ? '—'
                                  : String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="text-[13px] text-ink-muted">
                          No embedded metadata was present in this file.
                        </p>
                      )}
                    </CardBody>
                  </Card>
                </div>
              </ScanResultCard>
            )}

            {!scanning && !result && error && (
              <Alert tone="danger" title="Analysis failed">
                {error}
              </Alert>
            )}
          </div>
        </div>

        {/* Side rail */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="What gets checked"
              subtitle="Signals feeding the document risk assessment"
              icon={<Sparkles className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <ul className="space-y-2.5">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink-muted">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400/70"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="border-amber-500/25">
            <CardHeader
              title="This is not forensic proof"
              icon={<FileWarning className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Document analysis is a{' '}
                <span className="font-medium text-amber-300">risk assessment</span>, not a
                certification. A high score means potential anomalies were detected and the document
                requires manual verification — it does not prove forgery. A low score does not prove
                authenticity. Always confirm important documents with the issuing organisation
                directly.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
