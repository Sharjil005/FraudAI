import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AtSign, Eye, EyeOff, Lock, UserPlus, User as UserIcon } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { apiErrorMessage } from '@/services/api'
import { AuthFooterLink, AuthShell, useSubmitGuard } from '@/pages/AuthShell'
import { cn } from '@/lib/cn'

const HIGHLIGHTS = [
  'Free, unlimited scans across links, messages and documents.',
  'A permanent, searchable history of everything you have checked.',
  'No credit card, no external AI keys, no data sharing.',
]

interface PasswordRule {
  label: string
  test: (value: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { submitting, guard } = useSubmitGuard()

  const satisfied = PASSWORD_RULES.filter((rule) => rule.test(password)).length
  const strength = password ? Math.round((satisfied / PASSWORD_RULES.length) * 100) : 0

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = 'Enter your full name (at least 2 characters).'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    const failing = PASSWORD_RULES.filter((rule) => !rule.test(password))
    if (failing.length) next.password = `Password needs: ${failing[0].label.toLowerCase()}.`
    if (confirm !== password) next.confirm = 'Passwords do not match.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = guard(async () => {
    setError(null)
    if (!validate()) return
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      navigate('/dashboard', { replace: true })
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Registration failed. Please try again.'))
    }
  })

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a free FraudShield workspace — it takes about twenty seconds."
      highlights={HIGHLIGHTS}
      footer={
        <>
          Already registered? <AuthFooterLink to="/login">Sign in instead</AuthFooterLink>
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
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Priya Sharma"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
          icon={<UserIcon className="h-4 w-4" aria-hidden />}
          disabled={submitting}
        />

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

        <div>
          <Input
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Create a strong password"
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

          {password && (
            <div className="mt-3 animate-fade-in">
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    strength <= 25
                      ? 'bg-red-400'
                      : strength <= 50
                        ? 'bg-amber-400'
                        : strength <= 75
                          ? 'bg-cyan-400'
                          : 'bg-emerald-400',
                  )}
                  style={{ width: `${Math.max(8, strength)}%` }}
                />
              </div>
              <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password)
                  return (
                    <li
                      key={rule.label}
                      className={cn(
                        'flex items-center gap-1.5 text-[11px]',
                        ok ? 'text-emerald-300' : 'text-ink-faint',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          ok ? 'bg-emerald-400' : 'bg-surface-3',
                        )}
                        aria-hidden
                      />
                      {rule.label}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <Input
          label="Confirm password"
          name="confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={fieldErrors.confirm}
          icon={<Lock className="h-4 w-4" aria-hidden />}
          disabled={submitting}
        />

        <Button type="submit" block size="lg" loading={submitting} loadingText="Creating account…">
          <UserPlus className="h-4 w-4" aria-hidden />
          Create free account
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-ink-faint">
          By creating an account you accept that risk scores are advisory only and must not be used
          as the sole basis for a financial decision.
        </p>
      </form>
    </AuthShell>
  )
}
