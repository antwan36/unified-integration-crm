import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { CatalogItem, EstimateStatus, EstimateWithItems } from '../../../shared/types'
import { cleanIpcError } from '../lib/errors'
import LineItemsGrid, { emptyLineItem, type LineItemDraft } from '../components/LineItemsGrid'

function toDrafts(estimate: EstimateWithItems): LineItemDraft[] {
  if (estimate.items.length === 0) return [emptyLineItem()]
  return estimate.items.map((item) => ({
    ...emptyLineItem(),
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: (item.unitPriceCents / 100).toFixed(2)
  }))
}

function defaultDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

const STATUS_STYLES: Record<EstimateStatus, string> = {
  draft: 'bg-neutral-700/40 text-neutral-400',
  sent: 'bg-amber-500/15 text-amber-400',
  signed: 'bg-emerald-500/15 text-emerald-400',
  invoiced: 'bg-blue-500/15 text-blue-400'
}

export default function EstimateDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [estimate, setEstimate] = useState<EstimateWithItems | null>(null)
  const [title, setTitle] = useState('')
  const [taxPercent, setTaxPercent] = useState('')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLineItem()])
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [signUrl, setSignUrl] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [dueDate, setDueDate] = useState(defaultDueDate())
  const [showConvert, setShowConvert] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])

  useEffect(() => {
    window.api.catalog.list().then(setCatalogItems)
  }, [])

  const load = async (): Promise<void> => {
    if (!id) return
    const result = await window.api.estimates.get(id)
    setEstimate(result)
    if (result) {
      setTitle(result.title)
      setTaxPercent(result.taxPercent ? String(result.taxPercent) : '')
      setLineItems(toDrafts(result))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!estimate) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  const isDraft = estimate.status === 'draft'

  const subtotalCents = lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + Math.round(qty * price * 100)
  }, 0)
  const taxPercentValue = Number(taxPercent) || 0
  const taxCents = Math.round(subtotalCents * (taxPercentValue / 100))
  const totalCents = subtotalCents + taxCents

  const onSave = async (): Promise<void> => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const updated = await window.api.estimates.update(id, {
        title: title.trim(),
        taxPercent: taxPercentValue,
        items: lineItems
          .filter((item) => item.description.trim() && Number(item.unitPrice) > 0)
          .map((item) => ({
            description: item.description.trim(),
            quantity: Number(item.quantity) || 1,
            unitPriceCents: Math.round(Number(item.unitPrice) * 100)
          }))
      })
      setEstimate(updated)
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setSaving(false)
    }
  }

  const onSend = async (): Promise<void> => {
    setSending(true)
    setError(null)
    try {
      const result = await window.api.estimates.send(estimate.id)
      setSignUrl(result.signUrl)
      await load()
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setSending(false)
    }
  }

  const onConvert = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setConverting(true)
    setError(null)
    try {
      const invoice = await window.api.estimates.convertToInvoice(estimate.id, dueDate)
      navigate(`/contacts/${estimate.contactId}`, { state: { invoiceId: invoice.id } })
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setConverting(false)
    }
  }

  const onDelete = async (): Promise<void> => {
    if (!confirm(`Delete estimate "${estimate.title}"? This can't be undone.`)) return
    await window.api.estimates.delete(estimate.id)
    navigate(`/contacts/${estimate.contactId}`)
  }

  const onDuplicate = (): void => {
    navigate(`/contacts/${estimate.contactId}/estimates/new`, {
      state: {
        copyFrom: {
          title: estimate.title,
          taxPercent: estimate.taxPercent,
          lineItems: estimate.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents
          }))
        }
      }
    })
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        to={`/contacts/${estimate.contactId}`}
        className="no-print text-sm text-neutral-500 hover:text-neutral-300"
      >
        ← Back to contact
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">{estimate.title}</h1>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[estimate.status]}`}
        >
          {estimate.status}
        </span>
      </div>

      {estimate.status === 'signed' && (
        <p className="mt-2 text-sm text-emerald-400">
          Signed by {estimate.signerName} on{' '}
          {estimate.signedAt && new Date(estimate.signedAt).toLocaleString()}
        </p>
      )}
      {estimate.status === 'sent' && (
        <p className="mt-2 text-sm text-amber-400">
          Waiting on the client's signature{signUrl ? '' : ' — sent ' + (estimate.sentAt ? new Date(estimate.sentAt).toLocaleDateString() : '')}.
        </p>
      )}
      {estimate.status === 'invoiced' && (
        <p className="mt-2 text-sm text-blue-400">
          Converted to an invoice.{' '}
          <Link to={`/contacts/${estimate.contactId}`} className="underline">
            View it on the contact
          </Link>
          .
        </p>
      )}
      {signUrl && (
        <p className="mt-2 break-all text-xs text-neutral-500">
          Signing link: <span className="text-neutral-300">{signUrl}</span>
        </p>
      )}

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!isDraft}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary disabled:opacity-60"
          />
        </div>

        <LineItemsGrid
          items={lineItems}
          onChange={setLineItems}
          catalogItems={catalogItems}
          disabled={!isDraft}
        />

        <div>
          <label className="mb-1 block text-xs text-neutral-400">Tax %</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
            disabled={!isDraft}
            className="w-28 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary disabled:opacity-60"
          />
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
            <div className="font-semibold">
              Total: <span className="text-white">${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error && <span className="text-sm text-red-400">{error}</span>}
            <button
              onClick={onDuplicate}
              className="rounded border border-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Duplicate
            </button>
            <button
              onClick={() => window.print()}
              className="rounded border border-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Print / PDF
            </button>
            {isDraft && (
              <>
                <button
                  onClick={onDelete}
                  className="rounded px-3 py-2 text-xs text-red-400/70 hover:text-red-400"
                >
                  Delete
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="rounded border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={onSend}
                  disabled={sending || !title.trim()}
                  className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {sending ? 'Sending…' : 'Send for signature'}
                </button>
              </>
            )}
            {estimate.status === 'sent' && (
              <button
                onClick={onSend}
                disabled={sending}
                className="rounded border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {sending ? 'Resending…' : 'Resend'}
              </button>
            )}
            {estimate.status === 'signed' && !showConvert && (
              <button
                onClick={() => setShowConvert(true)}
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black"
              >
                Convert to invoice
              </button>
            )}
          </div>
        </div>

        {showConvert && (
          <form
            onSubmit={onConvert}
            className="flex items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Invoice due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={converting}
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {converting ? 'Creating…' : 'Create & send invoice'}
            </button>
            <button
              type="button"
              onClick={() => setShowConvert(false)}
              className="px-3 py-2 text-sm text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
