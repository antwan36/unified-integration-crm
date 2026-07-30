import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Contact, InvoiceWithLineItems } from '../../../shared/types'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge'
import { cleanIpcError } from '../lib/errors'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function InvoiceDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<InvoiceWithLineItems | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [costInput, setCostInput] = useState('')
  const [savingCost, setSavingCost] = useState(false)

  const load = async (): Promise<void> => {
    if (!id) return
    const inv = await window.api.invoices.get(id)
    setInvoice(inv)
    setCostInput(inv?.costCents ? (inv.costCents / 100).toFixed(2) : '')
    if (inv) {
      setContact(await window.api.contacts.get(inv.contactId))
    }
  }

  const onSaveCost = async (): Promise<void> => {
    if (!id) return
    setSavingCost(true)
    try {
      const costCents = Math.round((Number(costInput) || 0) * 100)
      const updated = await window.api.invoices.updateCost(id, costCents)
      if (updated) setInvoice((prev) => (prev ? { ...prev, costCents: updated.costCents } : prev))
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setSavingCost(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const onRefresh = async (): Promise<void> => {
    if (!id) return
    setRefreshing(true)
    try {
      await window.api.invoices.refresh(id)
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  const onSendDraft = async (): Promise<void> => {
    if (!id || !invoice) return
    if (!confirm(`Send this invoice to ${contact?.name ?? 'the client'} now? Square will email it immediately.`)) return
    setSending(true)
    setError(null)
    try {
      await window.api.invoices.sendDraft(id)
      await load()
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setSending(false)
    }
  }

  const onDelete = async (): Promise<void> => {
    if (!id || !invoice) return
    const isDraftDelete = invoice.status === 'DRAFT' || !invoice.squareInvoiceId
    const message = isDraftDelete
      ? `Delete "${invoice.title}"? This removes it from Square too and can't be undone.`
      : `Cancel "${invoice.title}"? The client will no longer be able to pay it. The record stays on the books as canceled.`
    if (!confirm(message)) return
    setError(null)
    try {
      const result = await window.api.invoices.delete(id)
      if (result.deleted) {
        navigate(invoice.contactId ? `/contacts/${invoice.contactId}` : '/invoices')
      } else {
        await load()
      }
    } catch (err) {
      setError(cleanIpcError(err))
    }
  }

  const onDuplicate = (): void => {
    if (!invoice) return
    navigate(`/contacts/${invoice.contactId}/invoices/new`, {
      state: {
        copyFrom: {
          title: invoice.title,
          taxPercent: invoice.taxPercent,
          shippingCents: invoice.shippingCents,
          lineItems: invoice.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPriceCents: li.unitPriceCents,
            link: li.link
          }))
        }
      }
    })
  }

  if (!invoice) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        to={contact ? `/contacts/${contact.id}` : '/invoices'}
        className="no-print text-sm text-neutral-500 hover:text-neutral-300"
      >
        ← {contact?.name ?? 'Back'}
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {invoice.title}
            {invoice.invoiceNumber ? ` · #${invoice.invoiceNumber}` : ''}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Created {new Date(invoice.createdAt).toLocaleDateString()} · due{' '}
            {new Date(invoice.dueDate).toLocaleDateString()}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit price</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {invoice.lineItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-white">
                  {item.description}
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="no-print ml-2 text-xs text-neutral-500 hover:text-primary"
                    >
                      link ↗
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-400">{item.quantity}</td>
                <td className="px-4 py-3 text-neutral-400">{formatCents(item.unitPriceCents)}</td>
                <td className="px-4 py-3 text-right text-neutral-400">
                  {formatCents(item.quantity * item.unitPriceCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 border-t border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm">
          <div className="flex justify-between text-neutral-400">
            <span>Subtotal</span>
            <span>{formatCents(invoice.subtotalCents)}</span>
          </div>
          {invoice.taxPercent > 0 && (
            <div className="flex justify-between text-neutral-400">
              <span>Tax ({invoice.taxPercent}%)</span>
              <span>{formatCents(Math.round(invoice.subtotalCents * (invoice.taxPercent / 100)))}</span>
            </div>
          )}
          {invoice.shippingCents > 0 && (
            <div className="flex justify-between text-neutral-400">
              <span>Shipping</span>
              <span>{formatCents(invoice.shippingCents)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-white">
            <span>Total</span>
            <span>{formatCents(invoice.totalCents)}</span>
          </div>
          {invoice.paidCents > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Paid</span>
              <span>{formatCents(invoice.paidCents)}</span>
            </div>
          )}
          {invoice.paidCents > 0 && invoice.paidCents < invoice.totalCents && (
            <div className="flex justify-between text-amber-400">
              <span>Balance due</span>
              <span>{formatCents(invoice.totalCents - invoice.paidCents)}</span>
            </div>
          )}
          {invoice.refundedCents > 0 && (
            <div className="flex justify-between text-purple-400">
              <span>Refunded</span>
              <span>{formatCents(invoice.refundedCents)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="no-print mt-6 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Profit</h2>
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">
            Internal only — never shown to the client
          </span>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">
              Cost (materials, labor, etc.)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="0.00"
              className="w-28 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={onSaveCost}
            disabled={savingCost}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            {savingCost ? 'Saving…' : 'Save'}
          </button>
          <div className="ml-auto space-y-0.5 text-right text-sm">
            <div className="text-neutral-400">
              Profit:{' '}
              <span className={invoice.totalCents - invoice.costCents >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {formatCents(invoice.totalCents - invoice.costCents)}
              </span>
            </div>
            {invoice.totalCents > 0 && (
              <div className="text-xs text-neutral-500">
                Margin: {(((invoice.totalCents - invoice.costCents) / invoice.totalCents) * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="no-print mt-6 flex items-center gap-3">
        {invoice.status === 'DRAFT' && invoice.squareInvoiceId && (
          <button
            onClick={onSendDraft}
            disabled={sending}
            className="rounded bg-primary px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send invoice'}
          </button>
        )}
        <a
          href={invoice.publicUrl ?? 'https://app.squareup.com/dashboard/invoices'}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
        >
          {invoice.publicUrl ? 'Open in Square' : 'Finish in Square'}
        </a>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          {refreshing ? 'Refreshing…' : 'Refresh status'}
        </button>
        <button
          onClick={onDuplicate}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
        >
          Duplicate
        </button>
        <button
          onClick={() => window.print()}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
        >
          Print / PDF
        </button>
        {!['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELED', 'FAILED'].includes(invoice.status) && (
          <button
            onClick={onDelete}
            className="rounded px-3 py-1.5 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
          >
            {invoice.status === 'DRAFT' || !invoice.squareInvoiceId ? 'Delete' : 'Cancel invoice'}
          </button>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  )
}
