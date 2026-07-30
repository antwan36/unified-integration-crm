import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EmailAccount, EmailActivity } from '../../../shared/types'
import { cleanIpcError } from '../lib/errors'

interface ComposeState {
  contactId: string | null
  emailAccountId: string
  to: string
  subject: string
  body: string
  inReplyTo: string | null
  references: string | null
}

const PAGE_SIZE = 50

export default function Email(): React.JSX.Element {
  const [items, setItems] = useState<EmailActivity[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [accounts, setAccounts] = useState<EmailAccount[]>([])

  const refreshUnreadCount = async (): Promise<void> => {
    setUnreadCount(await window.api.email.unreadCount())
  }

  const load = async (): Promise<void> => {
    const result = await window.api.email.list({
      search: search || undefined,
      unreadOnly: unreadOnly || undefined,
      limit: PAGE_SIZE,
      offset: 0
    })
    setItems(result.items)
    setTotal(result.total)
  }

  useEffect(() => {
    load()
    refreshUnreadCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, unreadOnly])

  useEffect(() => {
    window.api.emailAccounts.list().then(setAccounts)
  }, [])

  const loadMore = async (): Promise<void> => {
    const result = await window.api.email.list({
      search: search || undefined,
      unreadOnly: unreadOnly || undefined,
      limit: PAGE_SIZE,
      offset: items.length
    })
    setItems((prev) => [...prev, ...result.items])
    setTotal(result.total)
  }

  const selected = items.find((i) => i.id === selectedId) ?? null

  const onSelect = async (item: EmailActivity): Promise<void> => {
    setSelectedId(item.id)
    setCompose(null)
    if (!item.read) {
      await window.api.email.markRead(item.id)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)))
      refreshUnreadCount()
    }
  }

  const openComposeNew = (): void => {
    setSelectedId(null)
    setSendError(null)
    setCompose({
      contactId: null,
      emailAccountId: accounts[0]?.id ?? '',
      to: '',
      subject: '',
      body: '',
      inReplyTo: null,
      references: null
    })
  }

  const openReply = (item: EmailActivity): void => {
    setSendError(null)
    const subject = item.subject ?? ''
    setCompose({
      contactId: item.contactId,
      emailAccountId: item.emailAccountId ?? accounts[0]?.id ?? '',
      to: item.contactEmail ?? '',
      subject: subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`,
      body: '',
      inReplyTo: item.messageId,
      references: item.messageId
    })
  }

  const onSend = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!compose || !compose.to.trim() || !compose.subject.trim() || !compose.emailAccountId) return
    setSending(true)
    setSendError(null)
    try {
      let contactId = compose.contactId
      if (!contactId) {
        const contact = await window.api.contacts.findOrCreateByEmail(compose.to.trim())
        contactId = contact.id
      }
      await window.api.email.send({
        contactId,
        emailAccountId: compose.emailAccountId,
        to: compose.to.trim(),
        subject: compose.subject.trim(),
        body: compose.body,
        inReplyTo: compose.inReplyTo,
        references: compose.references
      })
      setCompose(null)
      load()
    } catch (err) {
      setSendError(cleanIpcError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex w-96 flex-shrink-0 flex-col border-r border-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <h1 className="text-lg font-semibold text-white">Email</h1>
          <button
            onClick={openComposeNew}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-black"
          >
            + Compose
          </button>
        </div>
        <div className="space-y-2 border-b border-neutral-800 p-3">
          <input
            placeholder="Search subject, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
          />
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Unread only {unreadCount > 0 ? `(${unreadCount})` : ''}
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && <p className="p-4 text-sm text-neutral-500">No emails found.</p>}
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`block w-full border-b border-neutral-800 px-4 py-3 text-left hover:bg-neutral-900 ${
                selectedId === item.id ? 'bg-neutral-900' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`truncate text-sm ${item.read ? 'text-neutral-300' : 'font-semibold text-white'}`}
                >
                  {item.direction === 'outbound' ? `To: ${item.contactName}` : item.contactName}
                </span>
                <span className="flex-shrink-0 text-[10px] text-neutral-500">
                  {new Date(item.occurredAt).toLocaleDateString()}
                </span>
              </div>
              <div
                className={`mt-0.5 truncate text-xs ${item.read ? 'text-neutral-500' : 'text-neutral-300'}`}
              >
                {!item.read && (
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                {item.subject || '(no subject)'}
              </div>
              {accounts.length > 1 && item.emailAccountLabel && (
                <div className="mt-1 inline-block rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
                  {item.emailAccountLabel}
                </div>
              )}
            </button>
          ))}
          {items.length < total && (
            <button
              onClick={loadMore}
              className="w-full py-3 text-center text-xs text-neutral-400 hover:text-white"
            >
              Load more
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {compose ? (
          <form onSubmit={onSend} className="mx-auto max-w-2xl space-y-3">
            <h2 className="text-sm font-semibold text-neutral-300">
              {compose.inReplyTo ? 'Reply' : 'New email'}
            </h2>
            {accounts.length > 1 && (
              <div>
                <label className="mb-1 block text-xs text-neutral-400">From</label>
                <select
                  value={compose.emailAccountId}
                  onChange={(e) => setCompose({ ...compose, emailAccountId: e.target.value })}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label} ({account.user})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-neutral-400">To</label>
              <input
                value={compose.to}
                onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                disabled={!!compose.contactId}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Subject</label>
              <input
                value={compose.subject}
                onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Message</label>
              <textarea
                value={compose.body}
                onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                rows={10}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            {sendError && <p className="text-sm text-red-400">{sendError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompose(null)}
                className="rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  sending || !compose.to.trim() || !compose.subject.trim() || !compose.emailAccountId
                }
                className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        ) : selected ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {selected.subject || '(no subject)'}
                </h2>
                <Link
                  to={`/contacts/${selected.contactId}`}
                  className="text-sm text-neutral-400 hover:text-primary hover:underline"
                >
                  {selected.contactName}
                  {selected.contactEmail ? ` <${selected.contactEmail}>` : ''}
                </Link>
                {accounts.length > 1 && selected.emailAccountLabel && (
                  <div className="mt-1 inline-block rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
                    via {selected.emailAccountLabel}
                  </div>
                )}
              </div>
              <span className="flex-shrink-0 text-xs text-neutral-500">
                {new Date(selected.occurredAt).toLocaleString()}
              </span>
            </div>
            <div className="whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-200">
              {selected.body}
            </div>
            {selected.direction === 'inbound' && (
              <button
                onClick={() => openReply(selected)}
                className="mt-4 rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
              >
                Reply
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Select an email to read it.</p>
        )}
      </div>
    </div>
  )
}
