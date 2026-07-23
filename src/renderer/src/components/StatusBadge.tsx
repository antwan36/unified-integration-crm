import type { ContactStatus } from '../../../shared/types'

const STYLES: Record<ContactStatus, string> = {
  New: 'bg-blue-500/15 text-blue-400',
  Contacted: 'bg-amber-500/15 text-amber-400',
  Quoted: 'bg-purple-500/15 text-purple-400',
  Won: 'bg-emerald-500/15 text-emerald-400',
  Lost: 'bg-neutral-700/40 text-neutral-400'
}

export default function StatusBadge({ status }: { status: ContactStatus }): React.JSX.Element {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>{status}</span>
  )
}
