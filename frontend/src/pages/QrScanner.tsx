import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Camera,
  CheckCircle2,
  FileDown,
  Link2,
  QrCode,
  Radar,
  ScanLine,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { LoadingPanel } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/PageHeader'
import { ScanResultCard, TargetRow } from '@/components/ScanResultCard'
import ShareAlertModal from '@/components/ShareAlertModal'
import { scanService } from '@/services/scanService'
import { reportService } from '@/services/reportService'
import { apiErrorMessage } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import type { QrScanResult } from '@/types'

type ScanMode = 'UPLOAD' | 'TEXT' | 'CAMERA'

const EXAMPLES = [
  {
    label: 'OLX Trap (Scan to receive)',
    hint: 'Buyer asks seller to scan QR to "receive" advance',
    payload: 'upi://pay?pa=olx.buyer.safe.verify@okhdfcbank&pn=OLX+Buyer&am=3500.00&cu=INR&tn=Advance+Payment+Hold',
    receiveIntent: true,
  },
  {
    label: 'Bank Support Impersonation',
    hint: 'Personal VPA disguised as SBI refund helpline',
    payload: 'upi://pay?pa=sbi-refund-desk@okaxis&pn=SBI+Helpline&am=4999.00&cu=INR&tn=Refund+Approval+Fee',
    receiveIntent: false,
  },
  {
    label: 'Genuine Supermarket QR',
    hint: 'Legitimate merchant with category code',
    payload: 'upi://pay?pa=freshmart@okaxis&pn=FreshMart+Supermarket&am=420.00&cu=INR&tn=Invoice+982&mc=5411',
    receiveIntent: false,
  },
]

const UPI_SECURITY_RULES = [
  {
    title: 'Receiving money NEVER requires a PIN',
    desc: 'You only ever enter your UPI PIN to SEND or DEBIT money from your bank account.',
  },
  {
    title: 'QR codes cannot credit funds',
    desc: 'Scanning a payment QR code will ALWAYS initiate a payment request from your balance.',
  },
  {
    title: 'Verify recipient name on app',
    desc: 'Check the real registered account name shown by your UPI app before completing any authorization.',
  },
  {
    title: 'Watch out for personal handles',
    desc: 'Official banks and utility companies never collect fees through individual handles like @okaxis or @ybl.',
  },
]

export default function QrScanner() {
  const toast = useToast()
  const [mode, setMode] = useState<ScanMode>('UPLOAD')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [textPayload, setTextPayload] = useState('')
  const [expectingToReceive, setExpectingToReceive] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QrScanResult | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [downloadingReport, setDownloadingReport] = useState(false)

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  // Clean up object URL & camera on unmount
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview)
      stopCamera()
    }
  }, [filePreview])

  // Scroll to verdict once ready
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  async function startCamera() {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err) {
      setCameraError(
        'Unable to access camera. Please verify camera permissions or upload an image instead.'
      )
      setCameraActive(false)
    }
  }

  function handleCaptureFromCamera() {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const capturedFile = new File([blob], 'camera_capture.png', { type: 'image/png' })
      setFile(capturedFile)
      if (filePreview) URL.revokeObjectURL(filePreview)
      setFilePreview(URL.createObjectURL(blob))
      stopCamera()
      setMode('UPLOAD')
      toast.push('Frame captured from camera. Click "Analyze QR Code" to scan.', 'info')
    }, 'image/png')
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, JPEG, WEBP).')
      return
    }
    setFile(selected)
    setError(null)
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFilePreview(URL.createObjectURL(selected))
  }

  function handleApplyPreset(preset: (typeof EXAMPLES)[number]) {
    setMode('TEXT')
    setTextPayload(preset.payload)
    setExpectingToReceive(preset.receiveIntent)
    setError(null)
    setResult(null)
    toast.push(`Applied sample preset: ${preset.label}`, 'info')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setResult(null)

    const intent = expectingToReceive ? 'RECEIVE_MONEY' : 'GENERAL_SCAN'

    if (mode === 'UPLOAD') {
      if (!file) {
        setError('Select or drop a QR code image to analyze.')
        return
      }
      setScanning(true)
      try {
        const data = await scanService.scanQr({
          file,
          claimed_intent: intent,
        })
        setResult(data)
        toast.push(`Analysis complete — ${data.prediction} (${data.risk_level})`, 'info')
      } catch (caught) {
        setError(apiErrorMessage(caught, 'Could not analyze the QR code image.'))
      } finally {
        setScanning(false)
      }
      return
    }

    if (mode === 'TEXT') {
      const candidate = textPayload.trim()
      if (!candidate) {
        setError('Paste a UPI link (upi://pay?...) or VPA handle to analyze.')
        return
      }
      setScanning(true)
      try {
        const data = await scanService.scanQr({
          payload: candidate,
          claimed_intent: intent,
        })
        setResult(data)
        toast.push(`Analysis complete — ${data.prediction} (${data.risk_level})`, 'info')
      } catch (caught) {
        setError(apiErrorMessage(caught, 'Could not analyze the UPI payload.'))
      } finally {
        setScanning(false)
      }
      return
    }
  }

  async function handleDownloadReport() {
    if (!result?.scan.scan_id) return
    setDownloadingReport(true)
    try {
      const filename = await reportService.download(result.scan.scan_id, 'pdf')
      toast.push(`Report downloaded: ${filename}`, 'info')
    } catch (err) {
      toast.push('Failed to download report', 'error')
    } finally {
      setDownloadingReport(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Payment Fraud Detection"
        title="QR & UPI Fraud Scanner"
        description="Inspect payment QR codes, UPI collect links, and VPA handles for fraud traps before approving transactions."
        icon={<QrCode className="h-5 w-5" aria-hidden />}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Submit Payment Target"
              subtitle="Upload a QR code screenshot, scan via webcam, or paste a UPI payment link"
              icon={<ScanLine className="h-4 w-4" aria-hidden />}
            />
            <CardBody className="space-y-5 pt-5">
              {/* Mode Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-hairline/60 pb-3">
                <Button
                  type="button"
                  variant={mode === 'UPLOAD' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    stopCamera()
                    setMode('UPLOAD')
                  }}
                >
                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                  Upload Image
                </Button>
                <Button
                  type="button"
                  variant={mode === 'TEXT' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    stopCamera()
                    setMode('TEXT')
                  }}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Paste UPI Link / ID
                </Button>
                <Button
                  type="button"
                  variant={mode === 'CAMERA' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setMode('CAMERA')
                    startCamera()
                  }}
                >
                  <Camera className="mr-1.5 h-3.5 w-3.5" />
                  Live Camera
                </Button>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* 1. UPLOAD MODE */}
                {mode === 'UPLOAD' && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      Upload QR Code Image / Screenshot
                    </label>
                    <div
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors',
                        file
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-hairline hover:border-cyan-400/40 bg-surface-1/40',
                      )}
                    >
                      {filePreview ? (
                        <div className="flex flex-col items-center space-y-3">
                          <img
                            src={filePreview}
                            alt="QR Preview"
                            className="max-h-48 max-w-full rounded-lg border border-hairline object-contain shadow-md"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-ink">{file?.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFile(null)
                                setFilePreview(null)
                              }}
                              className="rounded-full p-1 text-ink-muted hover:bg-hairline hover:text-ink"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <UploadCloud className="mx-auto h-10 w-10 text-ink-muted" />
                          <p className="mt-2 text-sm font-medium text-ink">
                            Drop payment QR screenshot here, or browse
                          </p>
                          <p className="mt-1 text-xs text-ink-faint">PNG, JPG, WEBP up to 10 MB</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        title=""
                      />
                    </div>
                  </div>
                )}

                {/* 2. TEXT MODE */}
                {mode === 'TEXT' && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      UPI Payment URI or Virtual Payment Address (VPA)
                    </label>
                    <Input
                      name="upi_payload"
                      type="text"
                      value={textPayload}
                      onChange={(e) => setTextPayload(e.target.value)}
                      placeholder="e.g. upi://pay?pa=store@okaxis&pn=Store&am=500.00 or merchant@okhdfcbank"
                      className="font-mono text-xs sm:text-sm"
                      autoFocus
                    />
                    <p className="text-[11px] text-ink-faint">
                      Supports standard NPCI URI schemes (`upi://pay?...`) or standalone UPI IDs.
                    </p>
                  </div>
                )}

                {/* 3. CAMERA MODE */}
                {mode === 'CAMERA' && (
                  <div className="space-y-3">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      Webcam / Phone Camera Preview
                    </label>
                    {cameraError ? (
                      <Alert tone="danger" title="Camera Unavailable">
                        {cameraError}
                      </Alert>
                    ) : (
                      <div className="relative overflow-hidden rounded-xl border border-hairline bg-abyss">
                        <video
                          ref={videoRef}
                          playsInline
                          autoPlay
                          muted
                          className="h-64 w-full object-cover"
                        />
                        {cameraActive && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="h-44 w-44 rounded-lg border-2 border-dashed border-cyan-400/80 bg-cyan-400/10 animate-pulse" />
                          </div>
                        )}
                        <div className="p-3 bg-surface-1/90 border-t border-hairline flex items-center justify-between">
                          <p className="text-xs text-ink-muted">
                            Center the QR code inside the box
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={handleCaptureFromCamera}
                          >
                            <Camera className="mr-1.5 h-3.5 w-3.5" />
                            Capture & Scan
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collect-Inversion Intent Toggle */}
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expectingToReceive}
                      onChange={(e) => setExpectingToReceive(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-amber-400/50 bg-void text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-amber-300">
                        Did someone ask you to scan this to RECEIVE money?
                      </span>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                        Check this if an OLX buyer, caller, or lottery agent claimed this QR code will
                        credit funds to your account.
                      </p>
                    </div>
                  </label>
                </div>

                {error && (
                  <Alert tone="danger" title="Scan Failed">
                    {error}
                  </Alert>
                )}

                {mode !== 'CAMERA' && (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button type="submit" variant="primary" size="lg" disabled={scanning}>
                      {scanning ? (
                        <>
                          <Radar className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Analyzing Payment Signals…
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                          Analyze QR Code
                        </>
                      )}
                    </Button>
                    {(file || textPayload) && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        onClick={() => {
                          setFile(null)
                          setFilePreview(null)
                          setTextPayload('')
                          setError(null)
                          setResult(null)
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                )}
              </form>

              {/* Sample Presets */}
              <div className="border-t border-hairline/60 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Test With Sample Scenarios (Viva / Presentation Demo)
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                  {EXAMPLES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="rounded-lg border border-hairline/70 bg-surface-1/60 p-2.5 text-left transition hover:border-cyan-400/40 hover:bg-surface-2"
                    >
                      <p className="text-xs font-semibold text-ink">{preset.label}</p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-ink-muted">{preset.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Loading state */}
          {scanning && (
            <LoadingPanel
              title="Deconstructing Payment Payload…"
              message="Parsing NPCI UPI specifications, validating payee identity, and checking for collect trap anomalies."
            />
          )}

          {/* Scan Verdict Surface */}
          {result && (
            <div ref={resultRef} className="space-y-4">
              <ScanResultCard
                scanId={result.scan.scan_id}
                score={result.risk_score}
                level={result.risk_level}
                prediction={result.prediction}
                confidence={result.confidence}
                explanation={result.explanation}
                recommendation={result.recommendation}
                indicators={result.indicators}
                target={
                  <div className="space-y-3">
                    <TargetRow
                      label="Decoded Target"
                      value={result.vpa ? `UPI: ${result.vpa}` : result.raw_payload}
                      copyable={true}
                    />
                    {result.qr_type === 'UPI' && (
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-lg border border-hairline bg-surface-2/60 p-2">
                          <span className="block text-[10px] text-ink-faint uppercase font-mono">
                            Payee Name
                          </span>
                          <span className="mt-0.5 block font-semibold text-ink truncate">
                            {result.payee_name || 'Not specified'}
                          </span>
                        </div>
                        <div className="rounded-lg border border-hairline bg-surface-2/60 p-2">
                          <span className="block text-[10px] text-ink-faint uppercase font-mono">
                            Amount
                          </span>
                          <span className="mt-0.5 block font-semibold text-ink">
                            {result.amount !== null && result.amount !== undefined
                              ? `₹${result.amount.toLocaleString()}`
                              : 'Variable / Open'}
                          </span>
                        </div>
                        <div className="rounded-lg border border-hairline bg-surface-2/60 p-2">
                          <span className="block text-[10px] text-ink-faint uppercase font-mono">
                            Note (tn)
                          </span>
                          <span className="mt-0.5 block font-semibold text-ink truncate">
                            {result.transaction_note || 'None'}
                          </span>
                        </div>
                        <div className="rounded-lg border border-hairline bg-surface-2/60 p-2">
                          <span className="block text-[10px] text-ink-faint uppercase font-mono">
                            Category Code
                          </span>
                          <span className="mt-0.5 block font-semibold text-ink">
                            {result.merchant_code || 'P2P / Personal'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                }
              >
                {/* Extra Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline/60 pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShareModalOpen(true)}
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5 text-cyan-300" />
                    Share Threat to Safety Circle
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={downloadingReport}
                    onClick={handleDownloadReport}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
                    {downloadingReport ? 'Downloading…' : 'Download Cybercrime Report'}
                  </Button>
                </div>
              </ScanResultCard>
            </div>
          )}
        </div>

        {/* Right Column: Educational Guidelines & Security Context */}
        <div className="space-y-5">
          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardHeader
              title="UPI Fraud Defense Rules"
              subtitle="Essential safety facts every user and evaluator should know"
              icon={<ShieldCheck className="h-4 w-4 text-cyan-400" aria-hidden />}
            />
            <CardBody className="space-y-3.5 pt-4">
              {UPI_SECURITY_RULES.map((rule, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                  <div>
                    <p className="text-xs font-semibold text-ink">{rule.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                      {rule.desc}
                    </p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Common Payment Scams"
              subtitle="Threat models detected by this engine"
              icon={<ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden />}
            />
            <CardBody className="space-y-3 pt-4 text-xs text-ink-muted leading-relaxed">
              <div className="rounded-lg border border-hairline/60 bg-surface-1/60 p-3">
                <p className="font-semibold text-ink">1. Collect Request Inversion</p>
                <p className="mt-1 text-[11px]">
                  Victims are promised a refund, cashback, or OLX purchase credit, but are sent a
                  debit collect request requiring a PIN.
                </p>
              </div>
              <div className="rounded-lg border border-hairline/60 bg-surface-1/60 p-3">
                <p className="font-semibold text-ink">2. Fake Bank Support VPAs</p>
                <p className="mt-1 text-[11px]">
                  Fraudsters register usernames like `sbi.kyc.helpline` on standard PSPs to appear
                  as legitimate banking staff.
                </p>
              </div>
              <div className="rounded-lg border border-hairline/60 bg-surface-1/60 p-3">
                <p className="font-semibold text-ink">3. Trojan QR Codes</p>
                <p className="mt-1 text-[11px]">
                  Physical stickers placed over merchant standees that quietly route customer payments
                  to an attacker's personal UPI account.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Share Alert Modal */}
      {result && (
        <ShareAlertModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          scanId={result.scan.scan_id}
        />
      )}
    </div>
  )
}
