import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReviewRequestWithDetails } from '../../../shared/types'

function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function ReviewRequests(): React.JSX.Element {
  const [requests, setRequests] = useState<ReviewRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  const refresh = async (): Promise<void> => {
    const list = await window.api.reviewRequests.list()
    setRequests(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const onSend = async (id: string): Promise<void> => {
    setBusyId(id)
    setErrorById((prev) => ({ ...prev, [id]: '' }))
    try {
      await window.api.reviewRequests.send(id)
      await refresh()
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Failed to send.'
      }))
    } finally {
      setBusyId(null)
    }
  }

  const onDismiss = async (id: string): Promise<void> => {
    setBusyId(id)
    try {
      await window.api.reviewRequests.dismiss(id)
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white">Review Requests</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Queued automatically when a customer's invoice is paid. Review each one and send it
        whenever you're ready — nothing goes out on its own.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">
          Nothing waiting right now. New requests show up here as invoices get paid.
        </p>
      ) : (
        <div className="mt-6 space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Link
                    to={`/contacts/${r.contactId}`}
                    className="text-sm font-medium text-white hover:underline"
                  >
                    {r.contactName}
                  </Link>
                  <div className="text-xs text-neutral-500">
                    {r.invoiceTitle} · paid {daysAgo(r.queuedAt)}
                    {!r.contactEmail && (
                      <span className="ml-2 text-amber-500">no email on file</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDismiss(r.id)}
                  disabled={busyId === r.id}
                  className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => onSend(r.id)}
                  disabled={busyId === r.id || !r.contactEmail}
                  className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
                >
                  {busyId === r.id ? 'Sending…' : 'Send'}
                </button>
              </div>
              {errorById[r.id] && (
                <p className="mt-2 text-xs text-red-400">{errorById[r.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
