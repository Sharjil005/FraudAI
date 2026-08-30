import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageSquare, Radar, Sparkles, Tags, TriangleAlert } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { LoadingPanel } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/PageHeader'
import { ScanResultCard } from '@/components/ScanResultCard'
import { scanService } from '@/services/scanService'
import { apiErrorMessage } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import type { MessageScanResult } from '@/types'

const MAX_LENGTH = 5000

const EXAMPLES = [
  {
    label: 'Bank account blocked',
    text: 'URGENT: Your bank account has been blocked due to suspicious activity. Verify your identity immediately by clicking http://sbi-verify-kyc.co/login and share the OTP sent to your phone. Failure to act within 2 hours will result in permanent closure.',
  },
  {
    label: 'Lottery prize',
    text: 'Congratulations! You have won ₹50,000 in our lucky draw. To claim your prize, send your bank account number, IFSC code and a processing fee of ₹499 to this number immediately.',
  },
  {
    label: 'Genuine OTP notice',
    text: 'Your OTP for login is 442819. It is valid for 10 minutes. Do not share it with anyone, including bank staff.',
  },
  {
    label: 'Delivery notification',
    text: 'Hi, your package has been dispatched and will arrive tomorrow between 10am and 1pm. Track it in the app under My Orders.',
  },
]

const CHECKLIST = [
  'Urgency and threat pressure ("within 2 hours", "account will be closed")',
  'OTP, PIN, CVV or password harvesting requests',
  'Lottery, prize and unexpected-windfall bait',
  'KYC / SIM / account-deactivation threats',
  'Advance-fee and processing-fee demands',
  'Embedded links, shortened links and lookalike domains',
  'Impersonation of banks, tax authorities and couriers',
]

export default function MessageScanner() {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MessageScanResult | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const text = message.trim()
    if (text.length < 5) {
      setError('Paste at least a few words of the message you want analysed.')
      return
    }
    if (text.length > MAX_LENGTH) {
      setError(`Messages are limited to ${MAX_LENGTH.toLocaleString()} characters.`)
      return
    }

    setScanning(true)
    setError(null)
    setResult(null)
    try {
      const data = await scanService.scanMessage(text)
      setResult(data)
      toast.push(`Analysis complete — ${data.prediction} (${data.risk_level})`, 'info')
    } catch (caught) {
      setError(apiErrorMessage(caught, 'The message could not be analysed.'))
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Message Scanner"
        title="Is this message a scam?"
        description="Paste any SMS, WhatsApp forward, or email body. A TF-IDF classifier and a social-engineering rule engine score it together."
        icon={<MessageSquare className="h-5 w-5" aria-hidden />}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Paste the message"
              subtitle="Include the whole text — links and phone numbers help accuracy"
              icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            />
            <CardBody className="space-y-4 pt-5">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <Textarea
                  name="message"
                  label="Message text"
                  placeholder="Paste the suspicious SMS, WhatsApp message or email here…"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  error={error && !result ? error : null}
                  rows={9}
                  counter
                  maxCount={MAX_LENGTH}
                  disabled={scanning}
                />

                <div className="flex flex-wrap gap-2.5">
                  <Button type="submit" loading={scanning} loadingText="Running AI fraud analysis…">
                    <Radar className="h-4 w-4" aria-hidden />
                    Analyse message
                  </Button>
                  {(result || message) && !scanning && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setMessage('')
                        setResult(null)
                        setError(null)
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </form>

              <div className="border-t border-hairline/60 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Try an example
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example.label}
                      type="button"
                      disabled={scanning}
                      onClick={() => {
                        setMessage(example.text)
                        setError(null)
                      }}
                      className="rounded-lg border border-hairline bg-surface-2/60 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-indigo-400/35 hover:text-ink disabled:opacity-50"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <div ref={resultRef}>
            {scanning && (
              <Card>
                <LoadingPanel
                  title="Running AI fraud analysis…"
                  message="Vectorising the text, scoring it against the scam classifier and matching social-engineering rules."
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
                target={
                  <div className="rounded-xl border border-hairline bg-abyss/60 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                      Analysed message
                    </p>
                    <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink scrollbar-none">
                      {result.message}
                    </p>
                  </div>
                }
              >
                {(result.detected_categories.length > 0 ||
                  result.suspicious_phrases.length > 0) && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    {result.detected_categories.length > 0 && (
                      <Card>
                        <CardHeader
                          title="Detected scam categories"
                          subtitle="Patterns this message matched"
                          icon={<Tags className="h-4 w-4" aria-hidden />}
                        />
                        <CardBody>
                          <div className="flex flex-wrap gap-2">
                            {result.detected_categories.map((category) => (
                              <Badge key={category} tone="warning">
                                {category}
                              </Badge>
                            ))}
                          </div>
                        </CardBody>
                      </Card>
                    )}

                    {result.suspicious_phrases.length > 0 && (
                      <Card>
                        <CardHeader
                          title="Suspicious phrases found"
                          subtitle="Exact wording that triggered rules"
                          icon={<TriangleAlert className="h-4 w-4" aria-hidden />}
                        />
                        <CardBody>
                          <ul className="space-y-1.5">
                            {result.suspicious_phrases.slice(0, 12).map((phrase) => (
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
                    )}
                  </div>
                )}
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
              subtitle="Signals feeding the message risk score"
              icon={<Sparkles className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <ul className="space-y-2.5">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink-muted">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/70"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="border-emerald-500/25">
            <CardHeader title="Golden rule" icon={<TriangleAlert className="h-4 w-4" aria-hidden />} />
            <CardBody>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                No legitimate bank, tax office or delivery company will ever ask you for an{' '}
                <span className="font-medium text-emerald-300">OTP, PIN, CVV or password</span> — by
                message, email or phone. If a message asks for one, it is fraudulent regardless of
                what this score says.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
