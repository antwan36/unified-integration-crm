import { useEffect, useState } from 'react'
import type { Payee, PayeeRateType, PayeeType, Payroll1099Summary, PayrollMethod, PayrollPayment } from '../../../../shared/types'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface PayeeForm {
  name: string
  type: PayeeType
  email: string
  phone: string
  taxId: string
  rateType: PayeeRateType
  defaultRate: string
}

function emptyPayeeForm(): PayeeForm {
  return { name: '', type: 'contractor', email: '', phone: '', taxId: '', rateType: 'hourly', defaultRate: '' }
}

function toPayeeForm(p: Payee): PayeeForm {
  return {
    name: p.name,
    type: p.type,
    email: p.email ?? '',
    phone: p.phone ?? '',
    taxId: '',
    rateType: p.rateType,
    defaultRate: p.defaultRateCents != null ? (p.defaultRateCents / 100).toFixed(2) : ''
  }
}

export default function PayrollTab(): React.JSX.Element {
  const [payees, setPayees] = useState<Payee[]>([])
  const [payments, setPayments] = useState<PayrollPayment[]>([])
  const [loading, setLoading] = useState(true)

  const [creatingPayee, setCreatingPayee] = useState(false)
  const [payeeForm, setPayeeForm] = useState<PayeeForm>(emptyPayeeForm())
  const [editingPayeeId, setEditingPayeeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    payeeId: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    method: 'ach' as PayrollMethod,
    memo: ''
  })

  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear())
  const [summary, setSummary] = useState<Payroll1099Summary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [revealedTaxId, setRevealedTaxId] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    const [p, pay] = await Promise.all([window.api.payees.list(), window.api.payroll.listPayments()])
    setPayees(p)
    setPayments(pay)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const onCreatePayee = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!payeeForm.name.trim()) return
    setSaving(true)
    try {
      await window.api.payees.create({
        name: payeeForm.name.trim(),
        type: payeeForm.type,
        email: payeeForm.email.trim() || null,
        phone: payeeForm.phone.trim() || null,
        taxId: payeeForm.taxId.trim() || null,
        rateType: payeeForm.rateType,
        defaultRateCents: payeeForm.defaultRate ? Math.round(Number(payeeForm.defaultRate) * 100) : null
      })
      setPayeeForm(emptyPayeeForm())
      setCreatingPayee(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const startEditPayee = (p: Payee): void => {
    setEditingPayeeId(p.id)
    setPayeeForm(toPayeeForm(p))
  }

  const onSaveEditPayee = async (id: string, active: boolean): Promise<void> => {
    if (!payeeForm.name.trim()) return
    setSaving(true)
    try {
      await window.api.payees.update(id, {
        name: payeeForm.name.trim(),
        type: payeeForm.type,
        email: payeeForm.email.trim() || null,
        phone: payeeForm.phone.trim() || null,
        taxId: payeeForm.taxId.trim() || null,
        rateType: payeeForm.rateType,
        defaultRateCents: payeeForm.defaultRate ? Math.round(Number(payeeForm.defaultRate) * 100) : null,
        active
      })
      setEditingPayeeId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onToggleActive = async (p: Payee): Promise<void> => {
    await window.api.payees.update(p.id, {
      name: p.name,
      type: p.type,
      email: p.email,
      phone: p.phone,
      rateType: p.rateType,
      defaultRateCents: p.defaultRateCents,
      active: !p.active
    })
    await load()
  }

  const onDeletePayee = async (id: string): Promise<void> => {
    if (!confirm('Delete this payee? Their payment history will be deleted too.')) return
    await window.api.payees.delete(id)
    await load()
  }

  const onAddPayment = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!paymentForm.payeeId || !Number(paymentForm.amount)) return
    setSaving(true)
    try {
      await window.api.payroll.createPayment({
        payeeId: paymentForm.payeeId,
        amountCents: Math.round(Number(paymentForm.amount) * 100),
        date: paymentForm.date,
        method: paymentForm.method,
        memo: paymentForm.memo.trim() || null
      })
      setPaymentForm({ ...paymentForm, amount: '', memo: '' })
      setAddingPayment(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onDeletePayment = async (id: string): Promise<void> => {
    if (!confirm('Delete this payment record?')) return
    await window.api.payroll.deletePayment(id)
    await load()
  }

  const onLoadSummary = async (): Promise<void> => {
    setLoadingSummary(true)
    setRevealedTaxId(null)
    try {
      setSummary(await window.api.payroll.get1099Summary(summaryYear))
    } finally {
      setLoadingSummary(false)
    }
  }

  const payeeName = (id: string): string => payees.find((p) => p.id === id)?.name ?? 'Unknown'

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Payees</h2>
            <p className="mt-1 text-xs text-neutral-500">Employees and contractors you pay.</p>
          </div>
          <button
            onClick={() => setCreatingPayee((v) => !v)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
          >
            + Add payee
          </button>
        </div>

        {creatingPayee && (
          <form
            onSubmit={onCreatePayee}
            className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Name</label>
              <input
                autoFocus
                value={payeeForm.name}
                onChange={(e) => setPayeeForm({ ...payeeForm, name: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Type</label>
              <select
                value={payeeForm.type}
                onChange={(e) => setPayeeForm({ ...payeeForm, type: e.target.value as PayeeType })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="employee">Employee</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Rate type</label>
              <select
                value={payeeForm.rateType}
                onChange={(e) => setPayeeForm({ ...payeeForm, rateType: e.target.value as PayeeRateType })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
                <option value="per_job">Per job</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Email (optional)</label>
              <input
                value={payeeForm.email}
                onChange={(e) => setPayeeForm({ ...payeeForm, email: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Default rate</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payeeForm.defaultRate}
                onChange={(e) => setPayeeForm({ ...payeeForm, defaultRate: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">SSN / EIN (optional)</label>
              <input
                type="password"
                value={payeeForm.taxId}
                onChange={(e) => setPayeeForm({ ...payeeForm, taxId: e.target.value })}
                placeholder="For 1099 reporting"
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div className="col-span-3">
              <button
                type="submit"
                disabled={saving || !payeeForm.name.trim()}
                className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {payees.map((p) =>
                editingPayeeId === p.id ? (
                  <tr key={p.id} className="bg-neutral-900/50">
                    <td className="px-4 py-2">
                      <input
                        autoFocus
                        value={payeeForm.name}
                        onChange={(e) => setPayeeForm({ ...payeeForm, name: e.target.value })}
                        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={payeeForm.type}
                        onChange={(e) => setPayeeForm({ ...payeeForm, type: e.target.value as PayeeType })}
                        className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                      >
                        <option value="employee">Employee</option>
                        <option value="contractor">Contractor</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payeeForm.defaultRate}
                        onChange={(e) => setPayeeForm({ ...payeeForm, defaultRate: e.target.value })}
                        className="w-24 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-2 text-neutral-400">{p.active ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => onSaveEditPayee(p.id, p.active)}
                        disabled={saving}
                        className="mr-3 text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPayeeId(null)}
                        className="text-xs text-neutral-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="hover:bg-neutral-900">
                    <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-3 text-neutral-400 capitalize">{p.type}</td>
                    <td className="px-4 py-3 text-neutral-400">
                      {p.defaultRateCents != null ? `${formatCents(p.defaultRateCents)} / ${p.rateType}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onToggleActive(p)}
                        className={`text-xs ${p.active ? 'text-emerald-400' : 'text-neutral-500'} hover:underline`}
                      >
                        {p.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEditPayee(p)}
                        className="mr-3 text-xs text-neutral-400 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeletePayee(p.id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
              {payees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                    No payees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Payments</h2>
            <p className="mt-1 text-xs text-neutral-500">What you've actually paid out.</p>
          </div>
          <button
            onClick={() => setAddingPayment((v) => !v)}
            disabled={payees.length === 0}
            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            + Log payment
          </button>
        </div>

        {addingPayment && (
          <form
            onSubmit={onAddPayment}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Payee</label>
              <select
                value={paymentForm.payeeId}
                onChange={(e) => setPaymentForm({ ...paymentForm, payeeId: e.target.value })}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="">Select…</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="w-28 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Date</label>
              <input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Method</label>
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PayrollMethod })}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="ach">ACH</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-neutral-400">Memo (optional)</label>
              <input
                value={paymentForm.memo}
                onChange={(e) => setPaymentForm({ ...paymentForm, memo: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !paymentForm.payeeId || !Number(paymentForm.amount)}
              className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Save
            </button>
          </form>
        )}

        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Payee</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Memo</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-neutral-900">
                  <td className="px-4 py-3 text-neutral-400">{pay.date}</td>
                  <td className="px-4 py-3 font-medium text-white">{payeeName(pay.payeeId)}</td>
                  <td className="px-4 py-3 text-neutral-400">{formatCents(pay.amountCents)}</td>
                  <td className="px-4 py-3 text-neutral-400 uppercase">{pay.method}</td>
                  <td className="px-4 py-3 text-neutral-400">{pay.memo ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onDeletePayment(pay.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No payments logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">1099 Summary</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Total paid to each contractor for a tax year. Tax IDs stay hidden until you click to reveal.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Year</label>
            <input
              type="number"
              value={summaryYear}
              onChange={(e) => setSummaryYear(Number(e.target.value))}
              className="w-24 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={onLoadSummary}
            disabled={loadingSummary}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {loadingSummary ? 'Loading…' : 'Load'}
          </button>
        </div>

        {summary && (
          <div className="mt-4 overflow-hidden rounded-lg border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Contractor</th>
                  <th className="px-4 py-2 font-medium">Total paid ({summary.year})</th>
                  <th className="px-4 py-2 font-medium">Tax ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {summary.lines.map((line) => (
                  <tr key={line.payeeId}>
                    <td className="px-4 py-3 font-medium text-white">{line.payeeName}</td>
                    <td className="px-4 py-3 text-neutral-400">{formatCents(line.totalCents)}</td>
                    <td className="px-4 py-3 text-neutral-400">
                      {!line.taxId ? (
                        '—'
                      ) : revealedTaxId === line.payeeId ? (
                        line.taxId
                      ) : (
                        <button
                          onClick={() => setRevealedTaxId(line.payeeId)}
                          className="text-xs text-primary hover:underline"
                        >
                          Reveal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {summary.lines.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                      No contractor payments in {summary.year}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
