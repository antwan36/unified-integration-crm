import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { CatalogItem, Contact } from '../../../shared/types'
import { cleanIpcError } from '../lib/errors'
import LineItemsGrid, {
  emptyLineItem,
  lineItemDraftFrom,
  type LineItemDraft
} from '../components/LineItemsGrid'
import type { CopyFromState } from './NewInvoice'

export default function NewEstimate(): React.JSX.Element {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const copyFrom = (location.state as { copyFrom?: CopyFromState } | null)?.copyFrom
  const [contactId, setContactId] = useState(id ?? '')
  const [contact, setContact] = useState<Contact | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [title, setTitle] = useState(copyFrom?.title ?? '')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(
    copyFrom
      ? copyFrom.lineItems.map((li) =>
          lineItemDraftFrom(li.description, li.unitPriceCents, String(li.quantity), li.link ?? '')
        )
      : [emptyLineItem()]
  )
  const [taxPercent, setTaxPercent] = useState(copyFrom?.taxPercent ? String(copyFrom.taxPercent) : '')
  const [shipping, setShipping] = useState(
    copyFrom?.shippingCents ? (copyFrom.shippingCents / 100).toFixed(2) : ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])

  useEffect(() => {
    if (id) {
      window.api.contacts.get(id).then((c) => c && setContact(c))
    } else {
      window.api.contacts.list().then(setContacts)
    }
  }, [id])

  useEffect(() => {
    window.api.catalog.list().then(setCatalogItems)
  }, [])

  const subtotalCents = lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + Math.round(qty * price * 100)
  }, 0)
  const taxPercentValue = Number(taxPercent) || 0
  const taxCents = Math.round(subtotalCents * (taxPercentValue / 100))
  const shippingCents = Math.round((Number(shipping) || 0) * 100)
  const totalCents = subtotalCents + taxCents + shippingCents

  const canSubmit =
    !!contactId &&
    title.trim().length > 0 &&
    lineItems.some((item) => item.description.trim() && Number(item.unitPrice) > 0)

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!contactId || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const estimate = await window.api.estimates.create({
        contactId,
        title: title.trim(),
        taxPercent: taxPercentValue,
        shippingCents,
        items: lineItems
          .filter((item) => item.description.trim() && Number(item.unitPrice) > 0)
          .map((item) => ({
            description: item.description.trim(),
            quantity: Number(item.quantity) || 1,
            unitPriceCents: Math.round(Number(item.unitPrice) * 100),
            link: item.link.trim() || null
          }))
      })
      navigate(`/estimates/${estimate.id}`)
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Link
        to={id ? `/contacts/${id}` : '/estimates'}
        className="text-sm text-neutral-500 hover:text-neutral-300"
      >
        ← {id ? (contact?.name ?? 'Contact') : 'Quotes'}
      </Link>

      <h1 className="mt-3 text-xl font-semibold text-white">New quote</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Build the list of items for this job. You can send it for the client's signature once
        you're happy with it.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {id ? (
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Client</label>
              <div className="rounded border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-sm text-neutral-300">
                {contact?.name ?? 'Loading…'}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Client</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="">Select a contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Home Theater Installation"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
        </div>

        <LineItemsGrid items={lineItems} onChange={setLineItems} catalogItems={catalogItems} />

        <div className="flex gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Tax %</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
              placeholder="0"
              className="w-28 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Shipping ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              placeholder="0.00"
              className="w-28 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
          <div className="space-y-0.5 text-sm text-neutral-400">
            <div>
              Subtotal: <span className="text-white">${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            {taxPercentValue > 0 && (
              <div>
                Tax ({taxPercentValue}%):{' '}
                <span className="text-white">${(taxCents / 100).toFixed(2)}</span>
              </div>
            )}
            {shippingCents > 0 && (
              <div>
                Shipping: <span className="text-white">${(shippingCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="font-semibold">
              Total: <span className="text-white">${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-red-400">{error}</span>}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {submitting ? 'Saving…' : 'Save draft'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
