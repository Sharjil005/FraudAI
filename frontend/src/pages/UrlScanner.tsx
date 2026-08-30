import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { Link2, Radar, ScanLine, ShieldAlert, Sparkles } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { LoadingPanel } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/PageHeader'
import { ScanResultCard, TargetRow } from '@/components/ScanResultCard'
import { scanService } from '@/services/scanService'
import { apiErrorMessage } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import type { UrlScanResult } from '@/types'

const EXAMPLES = [
  {
    label: 'Phishing login page',
    url: 'http://secure-login-verify-account.example.com/login?account=12345',
  },
  { label: 'Raw-IP netbanking clone', url: 'http://192.168.14.22/hdfc/netbanking/login.php' },
  { label: 'Lookalike brand domain', url: 'https://paypal.secure-login-update.xyz/verify' },
  { label: 'Legitimate site', url: 'https://www.google.com' },
]

const CHECKLIST = [
  'Hostname structure, length and hyphen stuffing',
  'Raw IP addresses and non-standard ports',
  'Suspicious or free top-level domains',
  'Brand names appearing outside their registered domain',
  'Credential and payment keywords in the path',
  'Sensitive parameters passed in the query string',
  'Punycode / homoglyph obfuscation and URL shorteners',
]

export default function UrlScanner() {
  const location = useLocation()
  const toast = useToast()
  const prefill = (location.state as { prefillUrl?: string } | null)?.prefillUrl

  const [url, setUrl] = useState(prefill ?? '')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UrlScanResult | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  // Scroll the verdict into view once it lands.
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const candidate = url.trim()
    if (!candidate) {
      setError('Enter a URL to analyse.')
      return
    }
    if (candidate.length > 2048) {
      setError('That URL is too long to analyse (2048 character limit).')
      return
    }

    setScanning(true)
    setError(null)
    setResult(null)
    try {
      const data = await scanService.scanUrl(candidate)
      setResult(data)
      toast.push(`Analysis complete — ${data.prediction} (${data.risk_level})`, 'info')
    } catch (caught) {
      setError(apiErrorMessage(caught, 'The URL could not be analysed.'))
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="URL Scanner"
        title="Check a link before you click it"
        description="FraudShield analyses the URL's structure offline — the page is never visited, so a malicious site never sees your device."
        icon={<Link2 className="h-5 w-5" aria-hidden />}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Submit a URL"
              subtitle="Full links work best — include http:// or https:// if you have it"
              icon={<ScanLine className="h-4 w-4" aria-hidden />}
            />
            <CardBody className="space-y-4 pt-5">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <Input
                  name="url"
                  label="Suspicious link"
                  placeholder="https://example.com/login?verify=1"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  error={error && !result ? error : null}
                  hint="We parse the link locally. Nothing is fetched or opened."
                  icon={<Link2 className="h-4 w-4" aria-hidden />}
                  spellCheck={false}
                  autoComplete="off"
                  className="font-mono text-[13px]"
                  disabled={scanning}
                />

                <div className="flex flex-wrap gap-2.5">
                  <Button type="submit" loading={scanning} loadingText="Analyzing URL patterns…">
                    <Radar className="h-4 w-4" aria-hidden />
                    Analyse URL
                  </Button>
                  {(result || url) && !scanning && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setUrl('')
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
                      key={example.url}
                      type="button"
                      disabled={scanning}
                      onClick={() => {
                        setUrl(example.url)
                        setError(null)
                      }}
                      className="rounded-lg border border-hairline bg-surface-2/60 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-cyan-400/35 hover:text-ink disabled:opacity-50"
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
                  title="Analyzing URL patterns…"
                  message="Extracting 28 lexical features, running the Random Forest classifier and applying the rule engine."
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
                  <div className="space-y-2.5">
                    <TargetRow label="Submitted URL" value={result.url} copyable mono />
                    {result.normalised_url !== result.url && (
                      <TargetRow label="Normalised URL" value={result.normalised_url} mono />
                    )}
                  </div>
                }
              />
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
              subtitle="Signals feeding the URL risk score"
              icon={<Sparkles className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <ul className="space-y-2.5">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink-muted">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70"
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
              title="Read the score, not just the label"
              icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                A <span className="font-medium text-emerald-300">LOW</span> score means no known
                fraud patterns were found — not that the site is certified safe. Brand-new phishing
                domains that copy a legitimate structure can still score low. Always confirm the
                sender through an official channel before entering credentials.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
