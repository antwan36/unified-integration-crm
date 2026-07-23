import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  Contact,
  EstimateWithContactName,
  InvoiceWithContactName
} from '../../../shared/types'

interface ResultItem {
  key: string
  kind: 'Contact' | 'Invoice' | 'Estimate'
  label: string
  detail: string
  to: string
}

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.toLowerCase()
  return fields.some((f) => f && f.toLowerCase().includes(q))
}

export default function SearchPalette({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithContactName[]>([])
  const [estimates, setEstimates] = useState<EstimateWithContactName[]>([])
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
    window.api.contacts.list().then(setContacts)
    window.api.invoices.listAll().then(setInvoices)
    window.api.estimates.listAll().then(setEstimates)
  }, [])

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim()
    if (!q) return []
    const out: ResultItem[] = []
    for (const c of contacts) {
      if (matches(q, c.name, c.email, c.phone, c.address)) {
        out.push({
          key: `c-${c.id}`,
          kind: 'Contact',
          label: c.name,
          detail: c.email ?? c.phone ?? c.status,
          to: `/contacts/${c.id}`
        })
      }
    }
    for (const inv of invoices) {
      if (matches(q, inv.title, inv.invoiceNumber, inv.contactName)) {
        out.push({
          key: `i-${inv.id}`,
          kind: 'Invoice',
          label: `${inv.title}${inv.invoiceNumber ? ` · #${inv.invoiceNumber}` : ''}`,
          detail: `${inv.contactName} · $${(inv.totalCents / 100).toFixed(2)} · ${inv.status.toLowerCase().replace(/_/g, ' ')}`,
          to: `/invoices/${inv.id}`
        })
      }
    }
    for (const est of estimates) {
      if (matches(q, est.title, est.contactName)) {
        out.push({
          key: `e-${est.id}`,
          kind: 'Estimate',
          label: est.title,
          detail: `${est.contactName} · $${(est.totalCents / 100).toFixed(2)} · ${est.status}`,
          to: `/estimates/${est.id}`
        })
      }
    }
    return out.slice(0, 12)
  }, [query, contacts, invoices, estimates])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const open = (item: ResultItem): void => {
    onClose()
    navigate(item.to)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && results[selected]) {
      open(results[selected])
    }
  }

  const KIND_STYLES: Record<ResultItem['kind'], string> = {
    Contact: 'bg-blue-500/15 text-blue-400',
    Invoice: 'bg-emerald-500/15 text-emerald-400',
    Estimate: 'bg-amber-500/15 text-amber-400'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search contacts, invoices, estimates…"
          className="w-full border-b border-neutral-800 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500"
        />
        <div className="max-h-80 overflow-y-auto">
          {results.map((item, index) => (
            <button
              key={item.key}
              onClick={() => open(item)}
              onMouseEnter={() => setSelected(index)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                index === selected ? 'bg-neutral-800' : ''
              }`}
            >
              <span
                className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-medium ${KIND_STYLES[item.kind]}`}
              >
                {item.kind}
              </span>
              <span className="truncate text-white">{item.label}</span>
              <span className="ml-auto truncate text-xs text-neutral-500">{item.detail}</span>
            </button>
          ))}
          {query.trim() && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">No matches.</p>
          )}
          {!query.trim() && (
            <p className="px-4 py-6 text-center text-xs text-neutral-600">
              Type to search — ↑↓ to pick, Enter to open, Esc to close.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
