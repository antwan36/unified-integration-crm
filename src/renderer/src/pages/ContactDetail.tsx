import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  Activity,
  Attachment,
  ContactStatus,
  ContactWithActivities,
  EmailAccount,
  Estimate,
  EstimateStatus,
  Invoice,
  InvoiceStatus,
  Task
} from '../../../shared/types'
import { CONTACT_STATUSES, JOB_TYPES } from '../../../shared/types'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge'
import { cleanIpcError } from '../lib/errors'

const PAID_STATUSES: InvoiceStatus[] = ['PAID']
const OUTSTANDING_STATUSES: InvoiceStatus[] = [
  'UNPAID',
  'SCHEDULED',
  'PARTIALLY_PAID',
  'PAYMENT_PENDING',
  'FAILED'
]

interface ComposeState {
  emailAccountId: string
  to: string
  subject: string
  body: string
  inReplyTo: string | null
  references: string | null
}

const ACTIVITY_ICON: Record<string, string> = {
  note: '📝',
  email: '✉️',
  form_submission: '🌐',
  status_change: '🔁',
  task: '✅',
  invoice: '🧾'
}

const NOTE_TYPES = ['General', 'Call', 'Site Visit', 'Meeting', 'Follow-up', 'Pricing/Quote', 'Issue']

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ESTIMATE_STATUS_STYLES: Record<EstimateStatus, string> = {
  draft: 'bg-neutral-700/40 text-neutral-400',
  sent: 'bg-amber-500/15 text-amber-400',
  signed: 'bg-emerald-500/15 text-emerald-400',
  invoiced: 'bg-blue-500/15 text-blue-400'
}

export default function ContactDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contact, setContact] = useState<ContactWithActivities | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskScheduled, setTaskScheduled] = useState(false)
  const [taskStartAt, setTaskStartAt] = useState('')
  const [taskEndAt, setTaskEndAt] = useState('')
  const [taskLocation, setTaskLocation] = useState('')
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState(NOTE_TYPES[0])
  const [addingNote, setAddingNote] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', jobType: '' })
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<EmailAccount[]>([])

  const load = async (): Promise<void> => {
    if (!id) return
    const result = await window.api.contacts.get(id)
    setContact(result)
    if (result) {
      setForm({
        name: result.name,
        email: result.email ?? '',
        phone: result.phone ?? '',
        address: result.address ?? '',
        jobType: result.jobType ?? ''
      })
    }
    setInvoices(await window.api.invoices.listForContact(id))
    setEstimates(await window.api.estimates.listForContact(id))
    setTasks(await window.api.tasks.listForContact(id))
    setAttachments(await window.api.attachments.listForContact(id))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    window.api.emailAccounts.list().then(setAccounts)
  }, [])

  if (!contact) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  const onStatusChange = async (status: ContactStatus): Promise<void> => {
    await window.api.contacts.update(contact.id, { status })
    load()
  }

  const onSaveInfo = async (): Promise<void> => {
    await window.api.contacts.update(contact.id, {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      jobType: form.jobType || null,
      unmatched: false
    })
    setEditing(false)
    load()
  }

  const onAddNote = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!note.trim()) return
    await window.api.contacts.addNote(contact.id, note.trim(), noteType)
    setNote('')
    setNoteType(NOTE_TYPES[0])
    setAddingNote(false)
    load()
  }

  const onDeleteNote = async (activityId: string): Promise<void> => {
    if (!confirm('Delete this note? This can\'t be undone.')) return
    await window.api.contacts.deleteNote(activityId)
    load()
  }

  const onAddTask = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!taskTitle.trim()) return
    if (taskScheduled && !taskStartAt) return
    await window.api.tasks.create({
      contactId: contact.id,
      title: taskTitle.trim(),
      dueDate: taskScheduled ? null : taskDueDate || null,
      startAt: taskScheduled && taskStartAt ? new Date(taskStartAt).toISOString() : null,
      endAt: taskScheduled && taskEndAt ? new Date(taskEndAt).toISOString() : null,
      location: taskScheduled ? taskLocation.trim() || null : null
    })
    setTaskTitle('')
    setTaskDueDate('')
    setTaskStartAt('')
    setTaskEndAt('')
    setTaskLocation('')
    load()
  }

  const onCompleteTask = async (taskId: string): Promise<void> => {
    await window.api.tasks.setDone(taskId, true)
    load()
  }

  const onDeleteTask = async (taskId: string): Promise<void> => {
    await window.api.tasks.delete(taskId)
    load()
  }

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !contact) return
    setUploadError(null)
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setUploadError(`"${file.name}" is too large (max 10MB).`)
      return
    }
    setUploading(true)
    try {
      const data = await file.arrayBuffer()
      await window.api.attachments.upload({
        contactId: contact.id,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        data
      })
      load()
    } catch (err) {
      setUploadError(cleanIpcError(err))
    } finally {
      setUploading(false)
    }
  }

  const onDownloadAttachment = async (attachmentId: string): Promise<void> => {
    const result = await window.api.attachments.download(attachmentId)
    if (!result) return
    const blob = new Blob([result.data], { type: result.mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const onDeleteAttachment = async (attachmentId: string): Promise<void> => {
    await window.api.attachments.delete(attachmentId)
    load()
  }

  const onDelete = async (): Promise<void> => {
    if (!confirm(`Delete ${contact.name}? This can't be undone.`)) return
    await window.api.contacts.delete(contact.id)
    navigate('/contacts')
  }

  const onRefreshInvoice = async (invoiceId: string): Promise<void> => {
    await window.api.invoices.refresh(invoiceId)
    load()
  }

  const openCompose = (): void => {
    setSendError(null)
    setCompose({
      emailAccountId: accounts[0]?.id ?? '',
      to: contact.email ?? '',
      subject: '',
      body: '',
      inReplyTo: null,
      references: null
    })
  }

  const openReply = (activity: Activity): void => {
    setSendError(null)
    const subject = activity.subject ?? ''
    setCompose({
      emailAccountId: activity.emailAccountId ?? accounts[0]?.id ?? '',
      to: contact.email ?? '',
      subject: subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`,
      body: '',
      inReplyTo: activity.messageId,
      references: activity.messageId
    })
  }

  const onSendEmail = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!compose || !compose.to.trim() || !compose.subject.trim() || !compose.emailAccountId) return
    setSending(true)
    setSendError(null)
    try {
      await window.api.email.send({
        contactId: contact.id,
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

  const composeForm = compose && (
    <form
      onSubmit={onSendEmail}
      className="mt-3 space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
    >
      {accounts.length > 1 && (
        <div>
          <label className="mb-1 block text-xs text-neutral-400">From</label>
          <select
            value={compose.emailAccountId}
            onChange={(e) => setCompose({ ...compose, emailAccountId: e.target.value })}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
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
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-400">Subject</label>
        <input
          value={compose.subject}
          onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-400">Message</label>
        <textarea
          value={compose.body}
          onChange={(e) => setCompose({ ...compose, body: e.target.value })}
          rows={6}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
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
  )

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link to="/contacts" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← Contacts
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{contact.name}</h1>
          {contact.unmatched && (
            <span className="mt-1 inline-block rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
              Unrecognized sender — confirm details below
            </span>
          )}
        </div>
        <select
          value={contact.status}
          onChange={(e) => onStatusChange(e.target.value as ContactStatus)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-white"
        >
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            {(['name', 'email', 'phone', 'address'] as const).map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs capitalize text-neutral-400">{field}</label>
                <input
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Job type</label>
              <select
                value={form.jobType}
                onChange={(e) => setForm({ ...form, jobType: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="">—</option>
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={onSaveInfo}
                className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-neutral-500">Email</div>
              <div className="text-white">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="hover:text-primary hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Phone</div>
              <div className="text-white">
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="hover:text-primary hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Address</div>
              <div className="text-white">
                {contact.address ? (
                  <a
                    href={`https://maps.apple.com/?q=${encodeURIComponent(contact.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary hover:underline"
                  >
                    {contact.address}
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Source</div>
              <div className="text-white">{contact.source}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Job type</div>
              <div className="text-white">{contact.jobType ?? '—'}</div>
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <button
                onClick={onDelete}
                className="text-xs text-red-400/70 hover:text-red-400"
              >
                Delete contact
              </button>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300">Notes</h2>
          <button
            onClick={() => setAddingNote((v) => !v)}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            {addingNote ? 'Cancel' : '+ Add note'}
          </button>
        </div>

        {addingNote && (
          <form
            onSubmit={onAddNote}
            className="flex gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-950 px-2 py-2 text-sm text-white outline-none focus:border-primary"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!note.trim()}
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Add
            </button>
          </form>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Tasks</h2>
        <form onSubmit={onAddTask} className="space-y-2">
          <div className="flex gap-2">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={taskScheduled ? 'Install at…' : 'Follow up about…'}
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-primary"
            />
            {!taskScheduled && (
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-primary"
              />
            )}
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black"
            >
              Add
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={taskScheduled}
              onChange={(e) => setTaskScheduled(e.target.checked)}
            />
            Schedule with a specific time
          </label>
          {taskScheduled && (
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={taskStartAt}
                onChange={(e) => setTaskStartAt(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
              <input
                type="datetime-local"
                value={taskEndAt}
                onChange={(e) => setTaskEndAt(e.target.value)}
                placeholder="End (optional)"
                className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
              <input
                value={taskLocation}
                onChange={(e) => setTaskLocation(e.target.value)}
                placeholder="Location (optional)"
                className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
          )}
        </form>
        <div className="mt-3 space-y-2">
          {tasks
            .filter((t) => !t.done)
            .map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => onCompleteTask(task.id)}
                  className="h-4 w-4"
                />
                <span className="flex-1 text-sm text-white">
                  {task.startAt && <span className="mr-1">📅</span>}
                  {task.title}
                  {task.location && (
                    <span className="ml-2 text-xs text-neutral-500">· {task.location}</span>
                  )}
                </span>
                {task.startAt ? (
                  <span className="text-xs text-neutral-500">
                    {new Date(task.startAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                ) : (
                  task.dueDate && (
                    <span className="text-xs text-neutral-500">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )
                )}
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="text-xs text-neutral-500 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          {tasks.every((t) => t.done) && (
            <p className="text-sm text-neutral-500">No open tasks.</p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300">Attachments</h2>
          <label className="cursor-pointer rounded border border-neutral-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">
            {uploading ? 'Uploading…' : '+ Upload file'}
            <input type="file" onChange={onUploadFile} disabled={uploading} className="hidden" />
          </label>
        </div>
        {uploadError && <p className="mb-2 text-xs text-red-400">{uploadError}</p>}
        <div className="space-y-2">
          {attachments.length === 0 && (
            <p className="text-sm text-neutral-500">No files yet.</p>
          )}
          {attachments.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5"
            >
              <button
                onClick={() => onDownloadAttachment(file.id)}
                className="text-left text-sm text-white hover:underline"
              >
                {file.filename}
                <span className="ml-2 text-xs text-neutral-500">
                  {formatFileSize(file.sizeBytes)}
                </span>
              </button>
              <button
                onClick={() => onDeleteAttachment(file.id)}
                className="text-xs text-neutral-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300">Timeline</h2>
          <button
            onClick={openCompose}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            + New email
          </button>
        </div>

        {compose && !compose.inReplyTo && composeForm}

        <div className="mt-3 space-y-3">
          {contact.activities.length === 0 && (
            <p className="text-sm text-neutral-500">No activity yet.</p>
          )}
          {contact.activities.map((a) => (
            <div key={a.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <span>{ACTIVITY_ICON[a.type] ?? '•'}</span>
                  <span>{a.subject ?? a.type.replace('_', ' ')}</span>
                </div>
                <span className="flex items-center gap-2 text-xs text-neutral-500">
                  {new Date(a.occurredAt).toLocaleString()}
                  {a.type === 'note' && (
                    <button
                      onClick={() => onDeleteNote(a.id)}
                      className="text-neutral-600 hover:text-red-400"
                      title="Delete note"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
              {a.body && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-400">
                  {a.body}
                </p>
              )}
              {a.type === 'email' && a.direction === 'inbound' && (
                <button
                  onClick={() => openReply(a)}
                  className="mt-2 text-xs text-neutral-400 hover:text-white"
                >
                  Reply
                </button>
              )}
              {compose?.inReplyTo === a.messageId && composeForm}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300">Quotes</h2>
          <Link
            to={`/contacts/${contact.id}/estimates/new`}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-black"
          >
            + New quote
          </Link>
        </div>
        <div className="space-y-2">
          {estimates.length === 0 && (
            <p className="text-sm text-neutral-500">No quotes yet.</p>
          )}
          {estimates.map((est) => (
            <Link
              key={est.id}
              to={`/estimates/${est.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700"
            >
              <div className="text-sm font-medium text-white">{est.title}</div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${ESTIMATE_STATUS_STYLES[est.status]}`}
              >
                {est.status}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-300">Invoices</h2>
            {invoices.length > 0 && (
              <p className="mt-0.5 text-xs text-neutral-500">
                $
                {(
                  invoices
                    .filter((i) => PAID_STATUSES.includes(i.status))
                    .reduce((sum, i) => sum + i.totalCents, 0) / 100
                ).toFixed(2)}{' '}
                collected
                {invoices.some((i) => OUTSTANDING_STATUSES.includes(i.status)) && (
                  <>
                    {' · $'}
                    {(
                      invoices
                        .filter((i) => OUTSTANDING_STATUSES.includes(i.status))
                        .reduce((sum, i) => sum + i.totalCents, 0) / 100
                    ).toFixed(2)}{' '}
                    outstanding
                  </>
                )}
              </p>
            )}
          </div>
          <Link
            to={`/contacts/${contact.id}/invoices/new`}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-black"
          >
            + New invoice
          </Link>
        </div>
        <div className="space-y-2">
          {invoices.length === 0 && (
            <p className="text-sm text-neutral-500">No invoices yet.</p>
          )}
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4"
            >
              <Link to={`/invoices/${inv.id}`} className="flex-1 hover:opacity-80">
                <div className="text-sm font-medium text-white">
                  {inv.title}
                  {inv.invoiceNumber ? ` · #${inv.invoiceNumber}` : ''}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  ${(inv.totalCents / 100).toFixed(2)}
                  {inv.taxPercent > 0 ? ` (incl. ${inv.taxPercent}% tax)` : ''} · due{' '}
                  {new Date(inv.dueDate).toLocaleDateString()}
                  {inv.paidCents > 0 && inv.paidCents < inv.totalCents && (
                    <span className="text-amber-400">
                      {' '}
                      · ${(inv.paidCents / 100).toFixed(2)} paid
                    </span>
                  )}
                  {inv.refundedCents > 0 && (
                    <span className="text-purple-400">
                      {' '}
                      · ${(inv.refundedCents / 100).toFixed(2)} refunded
                    </span>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <InvoiceStatusBadge status={inv.status} />
                <button
                  onClick={() => onRefreshInvoice(inv.id)}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Refresh
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
