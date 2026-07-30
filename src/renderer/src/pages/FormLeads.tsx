import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Contact } from '../../../shared/types'
import StatusBadge from '../components/StatusBadge'

export default function FormLeads(): React.JSX.Element {
  const [leads, setLeads] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    const list = await window.api.contacts.list({ source: 'website_form' })
    setLeads(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = leads.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Form Leads</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every submission from a website contact/quote form, landed here directly from Formspree.
          </p>
        </div>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
          {leads.length} total
        </span>
      </div>

      <div className="mt-4">
        <input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email / Phone</th>
              <th className="px-4 py-2 font-medium">Submitted</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3">
                  <Link to={`/contacts/${c.id}`} className="font-medium text-white hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-400">{c.email ?? c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {new Date(c.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  No form leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
