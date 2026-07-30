import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type {
  BankAccount,
  BankTransactionWithAccount,
  Contact,
  ExpenseCategory,
  FinancesSummaryPoint,
  PlaidItemSummary
} from '../../../../shared/types'
import { EXPENSE_CATEGORIES } from '../../../../shared/types'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function categoryLabel(cat: ExpenseCategory): string {
  return cat.replace(/_/g, ' ')
}

export default function BankAccountsTab(): React.JSX.Element {
  const [items, setItems] = useState<PlaidItemSummary[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransactionWithAccount[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [summary, setSummary] = useState<FinancesSummaryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    const [i, a, t, c, s] = await Promise.all([
      window.api.plaid.listItems(),
      window.api.bankAccounts.list(),
      window.api.bankTransactions.list(),
      window.api.contacts.list(),
      window.api.finances.summary()
    ])
    setItems(i)
    setAccounts(a)
    setTransactions(t)
    setContacts(c)
    setSummary(s)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      if (!publicToken) return
      setConnecting(true)
      try {
        const result = await window.api.plaid.exchangePublicToken(
          publicToken,
          metadata.institution?.name ?? 'Bank account'
        )
        if (!result.ok) {
          setLinkError(result.error ?? 'Could not link that account.')
        } else {
          await load()
        }
      } finally {
        setConnecting(false)
        setLinkToken(null)
      }
    },
    onExit: () => setLinkToken(null)
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  const onConnect = async (): Promise<void> => {
    setLinkError(null)
    setConnecting(true)
    try {
      const result = await window.api.plaid.createLinkToken()
      if (!result.ok || !result.linkToken) {
        setLinkError(result.error ?? 'Plaid is not set up yet — add your Client ID and Secret in Settings.')
        setConnecting(false)
        return
      }
      setLinkToken(result.linkToken)
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : String(err))
      setConnecting(false)
    }
  }

  const onSyncNow = async (): Promise<void> => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await window.api.plaid.sync()
      setSyncMessage(
        result.ok
          ? `Synced — ${result.transactionsAdded} new, ${result.transactionsModified} updated.`
          : `Failed: ${result.error}`
      )
      await load()
    } finally {
      setSyncing(false)
    }
  }

  const onCategoryChange = async (id: string, category: ExpenseCategory): Promise<void> => {
    await window.api.bankTransactions.update(id, { userCategory: category })
    await load()
  }

  const onContactChange = async (id: string, contactId: string): Promise<void> => {
    await window.api.bankTransactions.update(id, { contactId: contactId || null })
    await load()
  }

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  const totalIncome = summary.reduce((sum, m) => sum + m.incomeCents, 0)
  const totalExpense = summary.reduce((sum, m) => sum + m.expenseCents, 0)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Bank Accounts</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Linked via Plaid — transactions sync automatically every 10 minutes.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSyncNow}
            disabled={syncing || items.length === 0}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            onClick={onConnect}
            disabled={connecting}
            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            {connecting ? 'Connecting…' : '+ Connect a bank account'}
          </button>
        </div>
      </div>

      {linkError && <p className="mt-3 text-xs text-red-400">{linkError}</p>}
      {syncMessage && <p className="mt-3 text-xs text-neutral-400">{syncMessage}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500">Total income (all synced history)</div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">{formatCents(totalIncome)}</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500">Total expenses (all synced history)</div>
          <div className="mt-1 text-xl font-semibold text-red-400">{formatCents(totalExpense)}</div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Institution</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Current balance</th>
              <th className="px-4 py-2 font-medium">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3 font-medium text-white">{a.institutionName}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {a.name}
                  {a.mask ? ` ••${a.mask}` : ''}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {a.currentBalanceCents != null ? formatCents(a.currentBalanceCents) : '—'}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {a.availableBalanceCents != null ? formatCents(a.availableBalanceCents) : '—'}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  No bank accounts connected yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 text-sm font-semibold text-white">Transactions</h3>
      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Merchant</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Job</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3 text-neutral-400">
                  {tx.date}
                  {tx.pending && <span className="ml-1 text-amber-400">(pending)</span>}
                </td>
                <td className="px-4 py-3 text-white">{tx.merchantName ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-400">{tx.accountName}</td>
                <td className={`px-4 py-3 ${tx.amountCents < 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                  {tx.amountCents < 0 ? '+' : '-'}
                  {formatCents(Math.abs(tx.amountCents))}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={tx.userCategory ?? ''}
                    onChange={(e) => onCategoryChange(tx.id, e.target.value as ExpenseCategory)}
                    className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white outline-none focus:border-primary"
                  >
                    <option value="">Uncategorized</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={tx.contactId ?? ''}
                    onChange={(e) => onContactChange(tx.id, e.target.value)}
                    className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white outline-none focus:border-primary"
                  >
                    <option value="">No job</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No transactions synced yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
