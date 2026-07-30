import { useState } from 'react'
import BankAccountsTab from './finances/BankAccountsTab'
import PayrollTab from './finances/PayrollTab'
import InventoryTab from './finances/InventoryTab'

const TABS = [
  { id: 'bank', label: 'Bank Accounts' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'inventory', label: 'Inventory' }
] as const

type TabId = (typeof TABS)[number]['id']

export default function Finances(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('bank')

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white">Finances</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Bank accounts, payroll, and inventory — the rest of the business, alongside your leads and
        invoices.
      </p>

      <div className="mt-5 flex gap-1 border-b border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'bank' && <BankAccountsTab />}
        {tab === 'payroll' && <PayrollTab />}
        {tab === 'inventory' && <InventoryTab />}
      </div>
    </div>
  )
}
