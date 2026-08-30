import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AtSign, Eye, EyeOff, Lock, LogIn } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { apiErrorMessage } from '@/services/api'
import { AuthFooterLink, AuthShell, useSubmitGuard } from '@/pages/AuthShell'

const HIGHLIGHTS = [
  'Scan phishing links, scam texts and suspicious documents in one place.',
  'Every verdict is broken down into weighted, human-readable indicators.',
  'Download a shareable PDF report for any scan in your history.',
]

interface LocationState {
  from?: string
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as LocationState | null)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const { submitting, guard } = useSubmitGuard()

  function validate(): boolean {
    const next: { email?: string; password?: string } = {}
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'That email address looks invalid.'
    if (!password) next.password = 'Enter your password.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = guard(async () => {
    setError(null)
    if (!validate()) return
    try {
      await login({ email: email.trim().toLowerCase(), password })
      navigate(redirectTo, { replace: true })
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Sign in failed. Please check your credentials.'))
    }
  })

  function fillDemoAccount(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail)
    setPassword(demoPassword)
    setFieldErrors({})
    setError(null)
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to run new scans and review your fraud analysis history."
      highlights={HIGHLIGHTS}
      footer={
        <>
          Don&apos;t have an account? <AuthFooterLink to="/register">Create one free</AuthFooterLink>
          <span className="mx-2 text-ink-faint">·</span>
          <Link to="/" className="text-ink-faint transition-colors hover:text-ink-muted">
            Back to home
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          icon={<AtSign className="h-4 w-4" aria-hidden />}
          disabled={submitting}
        />

        <Input
          label="Password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          icon={<Lock className="h-4 w-4" aria-hidden />}
          disabled={submitting}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/5 hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          }
        />

        <Button type="submit" block size="lg" loading={submitting} loadingText="Signing you in…">
          <LogIn className="h-4 w-4" aria-hidden />
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-hairline bg-surface/60 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Demo accounts
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
          Seeded by <span className="font-mono text-[11px] text-cyan-300">python seed.py</span>.
          Click to fill the form.
        </p>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={() => fillDemoAccount('demo@fraudshield.local', 'Demo@12345')}
            className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-abyss/60 px-3 py-2 text-left transition-colors hover:border-cyan-400/30"
          >
            <span>
              <span className="block text-[12px] font-medium text-ink">Standard user</span>
              <span className="block font-mono text-[11px] text-ink-faint">
                demo@fraudshield.local / Demo@12345
              </span>
            </span>
            <span className="text-[11px] text-cyan-300">Use</span>
          </button>
          <button
            type="button"
            onClick={() => fillDemoAccount('admin@fraudshield.local', 'Admin@12345')}
            className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-abyss/60 px-3 py-2 text-left transition-colors hover:border-violet-400/30"
          >
            <span>
              <span className="block text-[12px] font-medium text-ink">Administrator</span>
              <span className="block font-mono text-[11px] text-ink-faint">
                admin@fraudshield.local / Admin@12345
              </span>
            </span>
            <span className="text-[11px] text-violet-300">Use</span>
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
