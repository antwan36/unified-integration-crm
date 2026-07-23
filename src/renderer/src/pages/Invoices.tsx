import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  InvoiceAnalytics,
  InvoiceStats,
  InvoiceStatus,
  InvoiceWithContactName
} from '../../../shared/types'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge'
import InvoiceRevenueChart from '../components/InvoiceRevenueChart'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const OUTSTANDING_STATUSES: InvoiceStatus[] = [
  'UNPAID',
  'SCHEDULED',
  'PARTIALLY_PAID',
  'PAYMENT_PENDING',
  'FAILED'
]

const FILTERS: { label: string; statuses: InvoiceStatus[] | null }[] = [
  { label: 'All', statuses: null },
  { label: 'Draft', statuses: ['DRAFT'] },
  { label: 'Outstanding', statuses: OUTSTANDING_STATUSES },
  { label: 'Paid', statuses: ['PAID'] }
]

function isOverdue(inv: InvoiceWithContactName): boolean {
  return (
    OUTSTANDING_STATUSES.includes(inv.status) &&
    inv.dueDate < new Date().toISOString().slice(0, 10)
  )
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  UNPAID: 'Unpaid',
  SCHEDULED: 'Scheduled',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
  CANCELED: 'Canceled',
  FAILED: 'Failed',
  PAYMENT_PENDING: 'Payment pending'
}

export default function Invoices(): React.JSX.Element {
  const [invoices, setInvoices] = useState<InvoiceWithContactName[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [analytics, setAnalytics] = useState<InvoiceAnalytics | null>(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    const [invoiceList, invoiceStats, invoiceAnalytics] = await Promise.all([
      window.api.invoices.listAll(),
      window.api.invoices.stats(),
      window.api.invoices.analytics()
    ])
    setInvoices(invoiceList)
    setStats(invoiceStats)
    setAnalytics(invoiceAnalytics)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const activeFilter = FILTERS[filterIndex]
  const visible = activeFilter.statuses
    ? invoices.filter((inv) => activeFilter.statuses!.includes(inv.status))
    : invoices

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white">Invoices</h1>

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-semibold text-white">
              {formatCents(stats.outstandingCents)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Outstanding · {stats.outstandingCount} invoice{stats.outstandingCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-semibold text-emerald-400">
              {formatCents(stats.paidCents)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Paid · {stats.paidCount} invoice{stats.paidCount === 1 ? '' : 's'}
            </div>
          </div>
          <div
            className={`rounded-lg border p-4 ${
              stats.overdueCount > 0
                ? 'border-red-800/50 bg-red-500/10'
                : 'border-neutral-800 bg-neutral-900'
            }`}
          >
            <div className={`text-2xl font-semibold ${stats.overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>
              {formatCents(stats.overdueCents)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Overdue · {stats.overdueCount} invoice{stats.overdueCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}

      {analytics && (
        <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-sm font-semibold text-white">Revenue</h2>
          <div className="mt-3 grid grid-cols-3 gap-4 border-b border-neutral-800 pb-5">
            <div>
              <div className="text-2xl font-bold text-white">
                {formatCents(analytics.totalInvoicedCents)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Total invoiced · {analytics.totalInvoicedCount} invoice
                {analytics.totalInvoicedCount === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCents(analytics.totalCollectedCents)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">Total collected, all-time</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {formatCents(analytics.averageInvoiceCents)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">Average invoice</div>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Invoiced by month
            </h3>
            <InvoiceRevenueChart data={analytics.monthly} />
          </div>

          <div className="mt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              By status
            </h3>
            <div className="space-y-1.5">
              {(() => {
                const maxStatusCents = Math.max(...analytics.byStatus.map((r) => r.totalCents), 1)
                return analytics.byStatus.map((row) => (
                  <div key={row.status} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 text-neutral-400">{STATUS_LABELS[row.status]}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${row.totalCents > 0 ? Math.max((row.totalCents / maxStatusCents) * 100, 2) : 0}%`
                        }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-neutral-300">
                      {formatCents(row.totalCents)}
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs text-neutral-500">
                      {row.count}
                    </span>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setFilterIndex(i)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              i === filterIndex
                ? 'bg-primary/15 text-primary'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Due</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {visible.map((inv) => (
              <tr key={inv.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3">
                  <Link
                    to={`/contacts/${inv.contactId}`}
                    className="font-medium text-white hover:underline"
                  >
                    {inv.contactName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/invoices/${inv.id}`} className="text-neutral-300 hover:text-white hover:underline">
                    {inv.title}
                    {inv.invoiceNumber ? ` · #${inv.invoiceNumber}` : ''}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-400">{formatCents(inv.totalCents)}</td>
                <td
                  className={`px-4 py-3 ${isOverdue(inv) ? 'font-medium text-red-400' : 'text-neutral-400'}`}
                >
                  {new Date(inv.dueDate).toLocaleDateString()}
                  {isOverdue(inv) ? ' · overdue' : ''}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
