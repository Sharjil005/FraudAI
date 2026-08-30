import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, History, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { PageHeader } from '@/components/PageHeader'
import { ScanHistoryTable } from '@/components/ScanHistoryTable'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { scanService } from '@/services/scanService'
import { apiErrorMessage } from '@/services/api'
import { RISK_LEVELS, RISK_BANDS } from '@/lib/risk'
import type { RiskLevel, ScanListItem, ScanListResponse, ScanType } from '@/types'

const PAGE_SIZE = 10
const SCAN_TYPES: ScanType[] = ['URL', 'MESSAGE', 'DOCUMENT']

export default function ScanHistory() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [scanType, setScanType] = useState<ScanType | ''>('')
  const [riskLevel, setRiskLevel] = useState<RiskLevel | ''>('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 400)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, loading, error, reload, setData } = useAsync<ScanListResponse>(
    () =>
      scanService.history({
        page,
        page_size: PAGE_SIZE,
        scan_type: scanType,
        risk_level: riskLevel,
        search: debouncedSearch,
      }),
    [page, scanType, riskLevel, debouncedSearch],
  )

  // Any filter change resets to the first page.
  useEffect(() => {
    setPage(1)
  }, [scanType, riskLevel, debouncedSearch])

  const filtersActive = Boolean(scanType || riskLevel || search)

  const meta = useMemo(
    () => data?.meta ?? { total: 0, page, page_size: PAGE_SIZE, total_pages: 0 },
    [data?.meta, page],
  )

  async function handleDelete(scan: ScanListItem) {
    const confirmed = window.confirm(
      `Delete scan #${scan.scan_id}? This permanently removes the analysis and its report.`,
    )
    if (!confirmed) return

    setDeletingId(scan.scan_id)
    try {
      await scanService.remove(scan.scan_id)
      toast.success(`Scan #${scan.scan_id} deleted`)
      if (data) {
        const remaining = data.items.filter((item) => item.scan_id !== scan.scan_id)
        if (remaining.length === 0 && page > 1) setPage(page - 1)
        else if (remaining.length === 0) reload()
        else
          setData({
            items: remaining,
            meta: { ...data.meta, total: Math.max(0, data.meta.total - 1) },
          })
      }
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'The scan could not be deleted.'))
    } finally {
      setDeletingId(null)
    }
  }

  function clearFilters() {
    setScanType('')
    setRiskLevel('')
    setSearch('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Scan history"
        description="Every analysis you have run, searchable and filterable. Open any scan for the full explainable breakdown or download its report."
        icon={<History className="h-5 w-5" aria-hidden />}
        action={
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-5" title="Could not load your history">
          {error}
        </Alert>
      )}

      <Card className="mb-5">
        <CardHeader
          title="Filters"
          subtitle="Narrow the list by type, risk band or keyword"
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
          action={
            filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-red-500/35 hover:text-red-200"
              >
                <X className="h-3 w-3" aria-hidden />
                Clear filters
              </button>
            ) : null
          }
        />
        <CardBody className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <Input
            name="search"
            label="Search"
            placeholder="Search URLs, message text or file names…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
          <Select
            name="scan_type"
            label="Scan type"
            value={scanType}
            onChange={(event) => setScanType(event.target.value as ScanType | '')}
          >
            <option value="">All types</option>
            {SCAN_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          <Select
            name="risk_level"
            label="Risk level"
            value={riskLevel}
            onChange={(event) => setRiskLevel(event.target.value as RiskLevel | '')}
          >
            <option value="">All risk levels</option>
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level} ({RISK_BANDS[level]})
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={filtersActive ? 'Filtered results' : 'All scans'}
          subtitle={
            loading && !data
              ? 'Loading…'
              : `${meta.total} scan${meta.total === 1 ? '' : 's'}${
                  filtersActive ? ' matching your filters' : ''
                }`
          }
          icon={<History className="h-4 w-4" aria-hidden />}
        />
        <ScanHistoryTable
          items={data?.items ?? []}
          loading={loading && !data}
          onDelete={handleDelete}
          deletingId={deletingId}
          emptyTitle={filtersActive ? 'No scans match those filters' : 'No scans yet'}
          emptyDescription={
            filtersActive
              ? 'Try widening the risk level, changing the scan type, or clearing the search box.'
              : 'Once you analyse a URL, message or document it will be listed here permanently.'
          }
          emptyAction={
            filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear filters
              </Button>
            ) : (
              <Link
                to="/dashboard/scan/url"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 text-[13px] font-semibold text-slate-950 transition hover:brightness-110"
              >
                Run your first scan
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )
          }
        />
        {data && data.items.length > 0 && <Pagination meta={meta} onChange={setPage} />}
      </Card>
    </div>
  )
}
