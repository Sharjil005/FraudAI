import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart3 } from 'lucide-react'
import { formatShortDate } from '@/lib/format'
import { riskTheme } from '@/lib/risk'
import type { RiskDistributionItem, ScanTrendPoint, ScanTypeCount, TopIndicator } from '@/types'

const AXIS = { stroke: '#1e2a4d' }
const TOOLTIP_STYLE = {
  backgroundColor: '#101731',
  border: '1px solid #1e2a4d',
  borderRadius: 12,
  fontSize: 12,
  color: '#eaf0ff',
  boxShadow: '0 20px 50px -20px rgba(0,0,0,0.8)',
}
const TYPE_COLOURS: Record<string, string> = {
  URL: '#22d3ee',
  MESSAGE: '#818cf8',
  DOCUMENT: '#f472b6',
}

function NoData({ message }: { message: string }) {
  return (
    <EmptyState
      icon={<BarChart3 className="h-6 w-6" aria-hidden />}
      title="Nothing to chart yet"
      description={message}
      className="py-10"
    />
  )
}

/** Stacked daily scan volume split by risk outcome. */
export function ScanTrendChart({ data }: { data: ScanTrendPoint[] }) {
  if (!data.some((point) => point.total > 0)) {
    return <NoData message="Run a few scans and your 14-day activity will appear here." />
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSafe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gradSuspicious" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#141c36" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          axisLine={AXIS}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={34} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) => formatShortDate(String(label))}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: '#9aa7c7', paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="safe"
          name="Safe"
          stackId="1"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#gradSafe)"
        />
        <Area
          type="monotone"
          dataKey="suspicious"
          name="Suspicious"
          stackId="1"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#gradSuspicious)"
        />
        <Area
          type="monotone"
          dataKey="high_risk"
          name="High risk"
          stackId="1"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#gradHigh)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Donut of LOW / MEDIUM / HIGH / CRITICAL counts. */
export function RiskDistributionChart({ data }: { data: RiskDistributionItem[] }) {
  const populated = data.filter((item) => item.count > 0)
  if (!populated.length) {
    return <NoData message="Your risk distribution appears once you have completed a scan." />
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={populated}
          dataKey="count"
          nameKey="risk_level"
          innerRadius={62}
          outerRadius={95}
          paddingAngle={3}
          stroke="#070a13"
          strokeWidth={2}
        >
          {populated.map((item) => (
            <Cell key={item.risk_level} fill={riskTheme(item.risk_level).hex} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => [`${value} scans`, String(name)]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: '#9aa7c7' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Bars for URL / MESSAGE / DOCUMENT volume. */
export function ScanTypeChart({ data }: { data: ScanTypeCount[] }) {
  if (!data.some((item) => item.count > 0)) {
    return <NoData message="Scan a URL, message or document to populate this breakdown." />
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#141c36" vertical={false} />
        <XAxis dataKey="scan_type" axisLine={AXIS} tickLine={false} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={34} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          formatter={(value) => [`${value} scans`, 'Volume']}
        />
        <Bar dataKey="count" name="Scans" radius={[8, 8, 0, 0]} maxBarSize={54}>
          {data.map((item) => (
            <Cell key={item.scan_type} fill={TYPE_COLOURS[item.scan_type] ?? '#22d3ee'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Horizontal bars of the most frequently triggered indicators (admin view). */
export function TopIndicatorsChart({ data }: { data: TopIndicator[] }) {
  if (!data.length) {
    return <NoData message="Indicator frequency builds up as users run scans." />
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#141c36" horizontal={false} />
        <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={170}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9aa7c7' }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          formatter={(value) => [`${value} times`, 'Triggered']}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
