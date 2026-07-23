import type { InvoiceStatus } from '../../../shared/types'

const STYLES: Partial<Record<InvoiceStatus, string>> = {
  DRAFT: 'bg-neutral-700/40 text-neutral-400',
  UNPAID: 'bg-amber-500/15 text-amber-400',
  SCHEDULED: 'bg-amber-500/15 text-amber-400',
  PARTIALLY_PAID: 'bg-blue-500/15 text-blue-400',
  PAID: 'bg-emerald-500/15 text-emerald-400',
  PARTIALLY_REFUNDED: 'bg-purple-500/15 text-purple-400',
  REFUNDED: 'bg-purple-500/15 text-purple-400',
  CANCELED: 'bg-neutral-700/40 text-neutral-400',
  FAILED: 'bg-red-500/15 text-red-400',
  PAYMENT_PENDING: 'bg-blue-500/15 text-blue-400'
}

function label(status: InvoiceStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export default function InvoiceStatusBadge({
  status
}: {
  status: InvoiceStatus
}): React.JSX.Element {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? 'bg-neutral-700/40 text-neutral-400'}`}
    >
      {label(status)}
    </span>
  )
}
