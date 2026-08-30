import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { RISK_BANDS, RISK_LEVELS, riskTheme } from '@/lib/risk'
import type { RiskLevel } from '@/types'

/** Animated circular risk gauge (0–100) with the four spec risk bands. */
export function RiskMeter({
  score,
  level,
  prediction,
  confidence,
  size = 190,
  className,
}: {
  score: number
  level: RiskLevel
  prediction?: string
  confidence?: number
  size?: number
  className?: string
}) {
  const theme = riskTheme(level)
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimated(score))
    return () => window.cancelAnimationFrame(frame)
  }, [score])

  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  // Leave a 25% gap at the bottom so the arc reads as a gauge.
  const arc = circumference * 0.75
  const offset = arc - (Math.min(100, Math.max(0, animated)) / 100) * arc

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[225deg]" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-surface-2"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.hex}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
              filter: `drop-shadow(0 0 10px ${theme.hex}66)`,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[2.75rem] font-semibold leading-none tabular-nums tracking-tight"
            style={{ color: theme.hex }}
          >
            {Math.round(score)}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-faint">
            Risk Score
          </span>
          <span className={cn('mt-2 text-xs font-semibold uppercase tracking-wider', theme.text)}>
            {level}
          </span>
        </div>
      </div>

      {prediction && (
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-ink">{prediction}</p>
          {confidence !== undefined && (
            <p className="mt-0.5 text-[11px] text-ink-faint">
              Model confidence {confidence.toFixed(0)}%
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Horizontal band scale showing where a score falls across LOW→CRITICAL. */
export function RiskScale({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {RISK_LEVELS.map((level) => (
          <div
            key={level}
            className="h-full flex-1"
            style={{ backgroundColor: `${riskTheme(level).hex}${'55'}` }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-4">
        <div
          className="absolute top-0 -translate-x-1/2 transition-[left] duration-1000 ease-out"
          style={{ left: `${Math.min(100, Math.max(0, score))}%` }}
        >
          <div className="h-3 w-[3px] rounded-full bg-ink" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-ink-faint">
        {RISK_LEVELS.map((level) => (
          <span key={level} className="flex-1 text-center">
            <span className="block font-semibold" style={{ color: riskTheme(level).hex }}>
              {level}
            </span>
            <span className="tabular-nums">{RISK_BANDS[level]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
