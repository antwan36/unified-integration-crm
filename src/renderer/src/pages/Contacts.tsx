import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Contact, ContactStatus } from '../../../shared/types'
import { CONTACT_STATUSES, JOB_TYPES } from '../../../shared/types'
import StatusBadge from '../components/StatusBadge'

export default function Contacts(): React.JSX.Element {
  const [searchParams] = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ContactStatus | ''>('')
  const [jobType, setJobType] = useState('')
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(
    searchParams.get('filter') === 'unmatched'
  )
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const load = async (): Promise<void> => {
    const list = await window.api.contacts.list({
      search: search || undefined,
      status: status || undefined,
      jobType: jobType || undefined
    })
    setContacts(showUnmatchedOnly ? list.filter((c) => c.unmatched) : list)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, jobType, showUnmatchedOnly])

  const onCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newName.trim()) return
    await window.api.contacts.create({ name: newName.trim(), email: newEmail.trim() || null })
    setNewName('')
    setNewEmail('')
    setCreating(false)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Contacts</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
        >
          + Add contact
        </button>
      </div>

      {creating && (
        <form
          onSubmit={onCreate}
          className="mt-4 flex items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-400">Name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-400">Email</label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
          >
            Save
          </button>
        </form>
      )}

      <div className="mt-4 flex items-center gap-3">
        <input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ContactStatus | '')}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        >
          <option value="">All statuses</option>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        >
          <option value="">All job types</option>
          {JOB_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-400">
          <input
            type="checkbox"
            checked={showUnmatchedOnly}
            onChange={(e) => setShowUnmatchedOnly(e.target.checked)}
          />
          Needs review only
        </label>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email / Phone</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Job type</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3">
                  <Link to={`/contacts/${c.id}`} className="font-medium text-white hover:underline">
                    {c.name}
                  </Link>
                  {c.unmatched && (
                    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                      needs review
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-400">{c.email ?? c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-400">{c.source}</td>
                <td className="px-4 py-3 text-neutral-400">{c.jobType ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
