import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  DashboardStats,
  EstimateWithContactName,
  InvoiceStats,
  TaskWithContactName
} from '../../../shared/types'
import StatusBadge from '../components/StatusBadge'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function Dashboard(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null)
  const [taskCounts, setTaskCounts] = useState<{ overdue: number; dueToday: number } | null>(null)
  const [awaitingSignature, setAwaitingSignature] = useState<EstimateWithContactName[]>([])
  const [todaysSchedule, setTodaysSchedule] = useState<TaskWithContactName[]>([])

  useEffect(() => {
    window.api.dashboard.stats().then(setStats)
    window.api.invoices.stats().then(setInvoiceStats)
    window.api.tasks.counts().then(setTaskCounts)
    window.api.estimates
      .listAll()
      .then((all) => setAwaitingSignature(all.filter((e) => e.status === 'sent')))
    window.api.tasks
      .listOpen()
      .then((tasks) => setTodaysSchedule(tasks.filter((t) => t.startAt && isToday(t.startAt))))
  }, [])

  if (!stats) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white">Dashboard</h1>

      <div className="mt-6 grid grid-cols-5 gap-4">
        {(Object.keys(stats.statusCounts) as (keyof typeof stats.statusCounts)[]).map((status) => (
          <div key={status} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-semibold text-white">{stats.statusCounts[status]}</div>
            <div className="mt-1 text-xs text-neutral-500">{status}</div>
          </div>
        ))}
      </div>

      {invoiceStats && (
        <Link
          to="/invoices"
          className="mt-4 grid grid-cols-3 gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700"
        >
          <div>
            <div className="text-lg font-semibold text-white">
              {formatCents(invoiceStats.outstandingCents)}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">Outstanding</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-emerald-400">
              {formatCents(invoiceStats.paidCents)}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">Paid</div>
          </div>
          <div>
            <div
              className={`text-lg font-semibold ${invoiceStats.overdueCount > 0 ? 'text-red-400' : 'text-white'}`}
            >
              {formatCents(invoiceStats.overdueCents)}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              Overdue{invoiceStats.overdueCount > 0 ? ` · ${invoiceStats.overdueCount}` : ''}
            </div>
          </div>
        </Link>
      )}

      {todaysSchedule.length > 0 && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-neutral-900 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            Today's schedule · {todaysSchedule.length}
          </div>
          <div className="space-y-1">
            {todaysSchedule.map((task) => (
              <Link
                key={task.id}
                to={`/contacts/${task.contactId}`}
                className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-neutral-800"
              >
                <span className="text-white">
                  <span className="font-semibold text-primary">{formatTime(task.startAt!)}</span>
                  {task.endAt ? (
                    <span className="text-neutral-500">–{formatTime(task.endAt)}</span>
                  ) : null}{' '}
                  {task.title}
                </span>
                <span className="text-xs text-neutral-500">
                  {task.contactName}
                  {task.location ? ` · ${task.location}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {awaitingSignature.length > 0 && (
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-amber-400">
            <span>Awaiting signature · {awaitingSignature.length}</span>
            <span>
              {formatCents(awaitingSignature.reduce((sum, e) => sum + e.totalCents, 0))} quoted
            </span>
          </div>
          <div className="space-y-1">
            {awaitingSignature.map((est) => (
              <Link
                key={est.id}
                to={`/estimates/${est.id}`}
                className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-neutral-800"
              >
                <span className="text-white">
                  {est.title}
                  <span className="ml-2 text-neutral-400">{formatCents(est.totalCents)}</span>
                </span>
                <span className="text-xs text-neutral-500">
                  {est.contactName}
                  {est.sentAt ? ` · sent ${new Date(est.sentAt).toLocaleDateString()}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {taskCounts && (taskCounts.overdue > 0 || taskCounts.dueToday > 0) && (
        <Link
          to="/tasks"
          className="mt-4 block rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-300 hover:border-neutral-700"
        >
          {taskCounts.overdue > 0 && (
            <span className="font-medium text-red-400">{taskCounts.overdue} overdue</span>
          )}
          {taskCounts.overdue > 0 && taskCounts.dueToday > 0 && ' · '}
          {taskCounts.dueToday > 0 && <span>{taskCounts.dueToday} due today</span>}
          {' — view tasks →'}
        </Link>
      )}

      {stats.staleLeads.length > 0 && (
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="text-sm font-semibold text-neutral-300">Needs follow-up</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Open leads with no activity in 5+ days.
          </p>
          <div className="mt-3 space-y-2">
            {stats.staleLeads.map((c) => (
              <Link
                key={c.id}
                to={`/contacts/${c.id}`}
                className="flex items-center justify-between rounded border border-neutral-800 px-3 py-2 hover:border-neutral-700"
              >
                <span className="text-sm text-white">{c.name}</span>
                <span className="text-xs text-neutral-500">
                  updated {new Date(c.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {stats.unmatchedCount > 0 && (
        <Link
          to="/contacts?filter=unmatched"
          className="mt-4 block rounded-lg border border-amber-800/50 bg-amber-500/10 p-3 text-sm text-amber-300 hover:bg-amber-500/15"
        >
          {stats.unmatchedCount} email{stats.unmatchedCount === 1 ? '' : 's'} from unknown senders
          need review →
        </Link>
      )}

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Recent leads</h2>
          <div className="space-y-2">
            {stats.recentContacts.length === 0 && (
              <p className="text-sm text-neutral-500">No contacts yet.</p>
            )}
            {stats.recentContacts.map((c) => (
              <Link
                key={c.id}
                to={`/contacts/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-700"
              >
                <div>
                  <div className="text-sm font-medium text-white">{c.name}</div>
                  <div className="text-xs text-neutral-500">{c.email ?? c.phone ?? c.source}</div>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Recent activity</h2>
          <div className="space-y-2">
            {stats.recentActivities.length === 0 && (
              <p className="text-sm text-neutral-500">Nothing yet.</p>
            )}
            {stats.recentActivities.map((a) => (
              <Link
                key={a.id}
                to={`/contacts/${a.contactId}`}
                className="block rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{a.contactName}</span>
                  <span className="text-xs text-neutral-500">
                    {new Date(a.occurredAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-neutral-500">
                  {a.subject ?? a.type}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
