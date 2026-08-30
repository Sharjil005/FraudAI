import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  FileText,
  Gauge,
  Link2,
  ListChecks,
  Lock,
  MessageSquare,
  Radar,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RiskScale } from '@/components/RiskMeter'
import { cn } from '@/lib/cn'
import { RISK_BANDS, RISK_LEVELS, riskTheme } from '@/lib/risk'
import { useAuth } from '@/hooks/useAuth'

const CAPABILITIES = [
  {
    icon: Link2,
    title: 'URL & Phishing Detection',
    body: 'A Random Forest model scores 28 lexical signals — punycode, raw IP hosts, brand impersonation, suspicious TLDs, credential-harvesting query strings — alongside a deterministic rule engine.',
    accent: 'from-cyan-400/20 to-cyan-400/0 text-cyan-300 border-cyan-400/25',
    to: '/dashboard/scan/url',
  },
  {
    icon: MessageSquare,
    title: 'Scam Message Analysis',
    body: 'TF-IDF classification combined with social-engineering rules catches urgency pressure, OTP harvesting, lottery bait, KYC threats and payment redirection in SMS, WhatsApp and email text.',
    accent: 'from-indigo-400/20 to-indigo-400/0 text-indigo-300 border-indigo-400/25',
    to: '/dashboard/scan/message',
  },
  {
    icon: FileText,
    title: 'Suspicious Document Review',
    body: 'Upload a screenshot, invoice or PDF. OCR extracts the text where available, then metadata, structural and language anomalies are flagged for manual verification.',
    accent: 'from-pink-400/20 to-pink-400/0 text-pink-300 border-pink-400/25',
    to: '/dashboard/scan/document',
  },
]

const PIPELINE = [
  {
    icon: FileSearch,
    title: 'Submit',
    body: 'Paste a link, drop in a message, or upload a document. Nothing leaves your deployment — analysis runs entirely on your own backend.',
  },
  {
    icon: BrainCircuit,
    title: 'Analyse',
    body: 'Machine-learning models and a weighted rule engine run in parallel, each producing a score, a confidence value and a list of triggered indicators.',
  },
  {
    icon: Gauge,
    title: 'Fuse',
    body: 'Signals are fused into one 0–100 risk score with hard floors, so a single critical indicator can never be averaged away by benign ones.',
  },
  {
    icon: ListChecks,
    title: 'Explain',
    body: 'You get the verdict, every contributing indicator with its weight, a plain-language explanation, and a concrete recommended action.',
  },
]

const DIFFERENTIATORS = [
  {
    icon: Sparkles,
    title: 'Explainable by design',
    body: 'Never just “Phishing: Yes”. Every score is itemised into weighted indicators a non-technical user can read.',
  },
  {
    icon: Zap,
    title: 'Sub-second verdicts',
    body: 'Feature extraction is pure lexical analysis — no external lookups, no third-party AI API, no rate limits.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Self-hosted FastAPI backend with JWT auth and bcrypt password hashing. Your scan data stays in your database.',
  },
  {
    icon: Radar,
    title: 'Three threat surfaces',
    body: 'Links, text and documents are the three vectors real victims encounter. FraudShield covers all three in one workspace.',
  },
]

const FAQ = [
  {
    q: 'Does FraudShield visit the links I submit?',
    a: 'No. Analysis is entirely lexical and structural — the URL is parsed and scored offline. Nothing is fetched, so a malicious page is never loaded and your IP is never exposed to the attacker.',
  },
  {
    q: 'Do I need an OpenAI or other paid AI key?',
    a: 'No. Both models (a Random Forest for URLs and a TF-IDF classifier for messages) are trained locally from bundled corpora on first boot and cached to disk. There are no external AI calls at any point.',
  },
  {
    q: 'What does the risk score actually mean?',
    a: 'It is a fused 0–100 value across four bands: LOW (0–29), MEDIUM (30–59), HIGH (60–79) and CRITICAL (80–100). The score reflects how many high-weight fraud indicators fired and how severe they are.',
  },
  {
    q: 'Can it prove a document is forged?',
    a: 'No, and it never claims to. Document analysis is a risk assessment that surfaces potential anomalies for manual verification. It is not forensic evidence and should not be treated as such.',
  },
  {
    q: 'Does a LOW score mean something is definitely safe?',
    a: 'It means no known fraud patterns were detected. Novel or highly targeted attacks can still score low, so treat the result as one signal among several — never as a guarantee.',
  },
]

const SAMPLE_INDICATORS = [
  { label: 'Credential-harvesting keywords in path', weight: 18, severity: 'high' },
  { label: 'Hyphen-stuffed hostname', weight: 14, severity: 'medium' },
  { label: 'Brand name outside registered domain', weight: 22, severity: 'critical' },
  { label: 'Account identifier passed in query string', weight: 12, severity: 'medium' },
]

export default function Landing() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [demoUrl, setDemoUrl] = useState(
    'http://secure-login-verify-account.example.com/login?account=12345',
  )
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  function handleDemo(event: FormEvent) {
    event.preventDefault()
    const target = isAuthenticated ? '/dashboard/scan/url' : '/register'
    navigate(target, { state: { prefillUrl: demoUrl } })
  }

  return (
    <div className="relative overflow-hidden">
      {/* ============ HERO ============ */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 grid-noise" aria-hidden />
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[130px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-56 right-0 h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-[130px]"
          aria-hidden
        />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-8 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/8 px-3 py-1 text-[11px] font-medium text-cyan-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </span>
              Explainable AI fraud detection · No external AI API
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
              Detect Digital Fraud
              <br />
              Before It{' '}
              <span className="text-gradient">Detects You.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted">
              FraudShield AI analyses suspicious links, scam messages and questionable documents in
              seconds — then shows you exactly which signals fired, how much each one mattered, and
              what to do next.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-6 text-[15px] font-semibold text-slate-950 shadow-[0_14px_40px_-14px_rgba(34,211,238,0.8)] transition hover:brightness-110"
              >
                {isAuthenticated ? 'Open dashboard' : 'Start scanning free'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#detection"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-hairline bg-surface-2/70 px-5 text-[15px] font-medium text-ink transition-colors hover:border-cyan-400/30 hover:bg-surface-3"
              >
                See how scoring works
              </a>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-hairline/60 pt-6">
              {[
                { value: '3', label: 'Threat surfaces' },
                { value: '28', label: 'URL features scored' },
                { value: '0–100', label: 'Explainable risk score' },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xl font-semibold tabular-nums text-ink sm:text-2xl">
                    {stat.value}
                  </dt>
                  <dd className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Live-ish demo card */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <Card className="relative overflow-hidden border-hairline/80 bg-surface/80">
              <div
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
                aria-hidden
              />
              <div className="flex items-center gap-2 border-b border-hairline/70 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" aria-hidden />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" aria-hidden />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" aria-hidden />
                <p className="ml-2 font-mono text-[11px] text-ink-faint">
                  fraudshield · url analysis
                </p>
              </div>

              <CardBody className="p-5">
                <form onSubmit={handleDemo}>
                  <label
                    htmlFor="demo-url"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
                  >
                    Suspicious link
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="demo-url"
                      value={demoUrl}
                      onChange={(event) => setDemoUrl(event.target.value)}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-hairline bg-abyss/80 px-3.5 font-mono text-[12px] text-ink outline-none transition-colors focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                      spellCheck={false}
                    />
                    <Button type="submit" size="md" className="sm:w-auto">
                      Analyse
                    </Button>
                  </div>
                </form>

                <div className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                        Verdict
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-orange-300">
                        Phishing · High Risk
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-semibold tabular-nums leading-none text-orange-300">
                        76
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                        Risk score
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <RiskScale score={76} />
                  </div>
                </div>

                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  Why — top indicators
                </p>
                <ul className="mt-2.5 space-y-2">
                  {SAMPLE_INDICATORS.map((indicator) => (
                    <li
                      key={indicator.label}
                      className="rounded-lg border border-hairline bg-surface-2/50 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-[12px] text-ink">
                          {indicator.label}
                        </p>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
                          +{indicator.weight}
                        </span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-abyss">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            indicator.severity === 'critical'
                              ? 'bg-red-400'
                              : indicator.severity === 'high'
                                ? 'bg-orange-400'
                                : 'bg-amber-400',
                          )}
                          style={{ width: `${(indicator.weight / 22) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
                  Illustrative output. Sign in to run this exact URL through the live engine.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* ============ CAPABILITIES ============ */}
      <section id="platform" className="scroll-mt-20 border-t border-hairline/50 bg-abyss/40">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              The platform
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Three detection engines, one risk language
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
              Each engine specialises in a different attack surface, but they all report into the
              same 0–100 scale with the same explainable indicator format.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <Card
                key={capability.title}
                className="group relative overflow-hidden transition-colors hover:border-cyan-400/25"
              >
                <div
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-60',
                    capability.accent,
                  )}
                  aria-hidden
                />
                <CardBody className="relative p-6">
                  <span
                    className={cn(
                      'grid h-11 w-11 place-items-center rounded-xl border bg-void/60',
                      capability.accent,
                    )}
                  >
                    <capability.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">{capability.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                    {capability.body}
                  </p>
                  <Link
                    to={capability.to}
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    Try it
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PIPELINE ============ */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-hairline/50">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              How it works
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              From submission to a decision you can defend
            </h2>
          </div>

          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((step, index) => (
              <li key={step.title} className="relative">
                <Card className="h-full">
                  <CardBody className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                        <step.icon className="h-4.5 w-4.5" aria-hidden />
                      </span>
                      <span className="font-mono text-2xl font-semibold tabular-nums text-surface-3">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-[14px] font-semibold text-ink">{step.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ RISK BANDS ============ */}
      <section id="detection" className="scroll-mt-20 border-t border-hairline/50 bg-abyss/40">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              Scoring
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              One score, four bands, zero ambiguity
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
              Rule-engine weights and model probabilities are fused with diminishing returns, then
              floored so that a single critical signal always lands in a serious band. The band tells
              you how to act; the indicators tell you why.
            </p>

            <div className="mt-7 space-y-3">
              {RISK_LEVELS.map((level) => {
                const theme = riskTheme(level)
                return (
                  <div
                    key={level}
                    className={cn(
                      'flex items-start gap-4 rounded-xl border px-4 py-3.5',
                      theme.border,
                      theme.bg,
                    )}
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: theme.hex }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn('text-[13px] font-semibold uppercase tracking-wider', theme.text)}>
                          {level}
                        </p>
                        <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                          {RISK_BANDS[level]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-muted">{theme.headline}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid content-start gap-5 sm:grid-cols-2">
            {DIFFERENTIATORS.map((item) => (
              <Card key={item.title} className="h-full">
                <CardBody className="p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/25 bg-violet-400/10 text-violet-300">
                    <item.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-[14px] font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="scroll-mt-20 border-t border-hairline/50">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 lg:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            FAQ
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Straight answers about the limits
          </h2>

          <div className="mt-8 divide-y divide-hairline/60 overflow-hidden rounded-2xl border border-hairline bg-surface/60">
            {FAQ.map((entry, index) => (
              <div key={entry.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  aria-expanded={openFaq === index}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <span className="text-[14px] font-medium text-ink">{entry.q}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300',
                      openFaq === index && 'rotate-180 text-cyan-300',
                    )}
                    aria-hidden
                  />
                </button>
                {openFaq === index && (
                  <p className="px-5 pb-4 text-[13px] leading-relaxed text-ink-muted animate-fade-in">
                    {entry.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="border-t border-hairline/50 bg-abyss/40">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <Card className="relative overflow-hidden border-cyan-400/20">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/12 via-transparent to-violet-500/12"
              aria-hidden
            />
            <CardBody className="relative flex flex-wrap items-center justify-between gap-6 p-8 lg:p-10">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-void/50 px-3 py-1 text-[11px] font-medium text-cyan-200">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Free to use · Self-hosted
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Stop guessing whether that message is real.
                </h2>
                <ul className="mt-4 space-y-1.5">
                  {[
                    'Unlimited URL, message and document scans',
                    'Full scan history with downloadable PDF reports',
                    'Explainable indicators on every single verdict',
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2 text-[13px] text-ink-muted">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2.5">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/register'}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-6 text-[15px] font-semibold text-slate-950 shadow-[0_14px_40px_-14px_rgba(34,211,238,0.8)] transition hover:brightness-110"
                >
                  {isAuthenticated ? 'Open dashboard' : 'Create free account'}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                {!isAuthenticated && (
                  <Link
                    to="/login"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-hairline bg-surface-2/70 px-6 text-[15px] font-medium text-ink transition-colors hover:border-cyan-400/30"
                  >
                    I already have an account
                  </Link>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  )
}
