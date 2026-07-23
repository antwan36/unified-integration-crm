import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EstimateStatus, EstimateWithContactName } from '../../../shared/types'

const STATUS_STYLES: Record<EstimateStatus, string> = {
  draft: 'bg-neutral-700/40 text-neutral-400',
  sent: 'bg-amber-500/15 text-amber-400',
  signed: 'bg-emerald-500/15 text-emerald-400',
  invoiced: 'bg-blue-500/15 text-blue-400'
}

export default function Estimates(): React.JSX.Element {
  const [estimates, setEstimates] = useState<EstimateWithContactName[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.estimates.listAll().then((result) => {
      setEstimates(result)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white">Estimates</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Start a new one from a contact's page — build the item list, send it for signature, then
        convert it to an invoice once signed.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {estimates.map((est) => (
              <tr key={est.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3">
                  <Link
                    to={`/contacts/${est.contactId}`}
                    className="font-medium text-white hover:underline"
                  >
                    {est.contactName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  <Link to={`/estimates/${est.id}`} className="hover:text-white hover:underline">
                    {est.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  ${(est.totalCents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[est.status]}`}
                  >
                    {est.status}
                  </span>
                </td>
              </tr>
            ))}
            {estimates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  No estimates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
