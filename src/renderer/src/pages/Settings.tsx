import { useEffect, useState } from 'react'
import type {
  EmailAccount,
  SquareEnvironment,
  SquareSettings,
  SquareSyncResult,
  SquareTestResult,
  SyncResult,
  TeamMember
} from '../../../shared/types'

const EMPTY_ACCOUNT_FORM = {
  label: '',
  host: '',
  port: 993,
  secure: true,
  user: '',
  password: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false
}

export default function Settings(): React.JSX.Element {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [squareCurrent, setSquareCurrent] = useState<SquareSettings | null>(null)
  const [squareForm, setSquareForm] = useState({
    accessToken: '',
    environment: 'production' as SquareEnvironment,
    locationId: ''
  })
  const [squareTestResult, setSquareTestResult] = useState<SquareTestResult | null>(null)
  const [squareTesting, setSquareTesting] = useState(false)
  const [squareSaving, setSquareSaving] = useState(false)
  const [squareSyncResult, setSquareSyncResult] = useState<SquareSyncResult | null>(null)
  const [squareSyncing, setSquareSyncing] = useState(false)

  const [portalUrl, setPortalUrl] = useState('')
  const [portalUrlSaved, setPortalUrlSaved] = useState<string | null>(null)
  const [portalSaving, setPortalSaving] = useState(false)

  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null)
  const [calendarResetting, setCalendarResetting] = useState(false)
  const [calendarCopied, setCalendarCopied] = useState(false)

  const [exportingContacts, setExportingContacts] = useState(false)
  const [exportingInvoices, setExportingInvoices] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const [team, setTeam] = useState<TeamMember[]>([])
  const [addingTeammate, setAddingTeammate] = useState(false)
  const [teammateForm, setTeammateForm] = useState({ name: '', email: '', password: '' })
  const [teammateSaving, setTeammateSaving] = useState(false)
  const [teammateError, setTeammateError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setAccounts(await window.api.emailAccounts.list())

    const square = await window.api.settings.getSquare()
    setSquareCurrent(square)
    if (square) {
      setSquareForm((f) => ({ ...f, environment: square.environment, locationId: square.locationId }))
    }

    const savedPortalUrl = await window.api.settings.getPortalUrl()
    setPortalUrlSaved(savedPortalUrl)
    if (savedPortalUrl) setPortalUrl(savedPortalUrl)

    setCalendarFeedUrl(await window.api.settings.getCalendarFeedUrl())

    setTeam(await window.api.users.list())
  }

  useEffect(() => {
    load()
  }, [])

  const onAddAccount = (): void => {
    setEditingAccountId('new')
    setTestResult(null)
    setAccountForm(EMPTY_ACCOUNT_FORM)
  }

  const onEditAccount = (account: EmailAccount): void => {
    setEditingAccountId(account.id)
    setTestResult(null)
    setAccountForm({
      label: account.label,
      host: account.host,
      port: account.port,
      secure: account.secure,
      user: account.user,
      password: '',
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure
    })
  }

  const onCancelAccountForm = (): void => {
    setEditingAccountId(null)
    setTestResult(null)
    setAccountForm(EMPTY_ACCOUNT_FORM)
  }

  const onDeleteAccount = async (id: string): Promise<void> => {
    if (
      !confirm(
        "Remove this email account? It'll stop syncing, but emails already in the Email inbox stay."
      )
    ) {
      return
    }
    await window.api.emailAccounts.delete(id)
    await load()
  }

  const onTestAccount = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.emailAccounts.test({
        host: accountForm.host,
        port: Number(accountForm.port),
        secure: accountForm.secure,
        user: accountForm.user,
        password: accountForm.password
      })
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const onSaveAccount = async (): Promise<void> => {
    setSavingAccount(true)
    try {
      const payload = {
        label: accountForm.label.trim() || accountForm.user,
        host: accountForm.host,
        port: Number(accountForm.port),
        secure: accountForm.secure,
        user: accountForm.user,
        smtpHost: accountForm.smtpHost || accountForm.host,
        smtpPort: Number(accountForm.smtpPort),
        smtpSecure: accountForm.smtpSecure
      }
      if (editingAccountId && editingAccountId !== 'new') {
        await window.api.emailAccounts.update(editingAccountId, {
          ...payload,
          password: accountForm.password || undefined
        })
      } else {
        await window.api.emailAccounts.create({ ...payload, password: accountForm.password })
      }
      setEditingAccountId(null)
      setAccountForm(EMPTY_ACCOUNT_FORM)
      setTestResult(null)
      await load()
    } finally {
      setSavingAccount(false)
    }
  }

  const onSyncNow = async (): Promise<void> => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await window.api.sync.run()
      setSyncResult(result)
    } finally {
      setSyncing(false)
    }
  }

  const onTestSquare = async (): Promise<void> => {
    setSquareTesting(true)
    setSquareTestResult(null)
    try {
      const result = await window.api.settings.testSquare({
        accessToken: squareForm.accessToken,
        environment: squareForm.environment
      })
      setSquareTestResult(result)
      if (result.ok && result.locations?.length && !squareForm.locationId) {
        setSquareForm((f) => ({ ...f, locationId: result.locations![0].id }))
      }
    } finally {
      setSquareTesting(false)
    }
  }

  const onSaveSquare = async (): Promise<void> => {
    setSquareSaving(true)
    try {
      const locationName =
        squareTestResult?.locations?.find((l) => l.id === squareForm.locationId)?.name ?? null
      await window.api.settings.saveSquare(
        {
          accessToken: squareForm.accessToken,
          environment: squareForm.environment,
          locationId: squareForm.locationId
        },
        locationName
      )
      setSquareForm((f) => ({ ...f, accessToken: '' }))
      await load()
    } finally {
      setSquareSaving(false)
    }
  }

  const onSyncSquare = async (): Promise<void> => {
    setSquareSyncing(true)
    setSquareSyncResult(null)
    try {
      const result = await window.api.square.sync()
      setSquareSyncResult(result)
    } finally {
      setSquareSyncing(false)
    }
  }

  const onSavePortalUrl = async (): Promise<void> => {
    setPortalSaving(true)
    try {
      await window.api.settings.savePortalUrl(portalUrl.trim())
      setPortalUrlSaved(portalUrl.trim())
      setCalendarFeedUrl(await window.api.settings.getCalendarFeedUrl())
    } finally {
      setPortalSaving(false)
    }
  }

  const onCopyCalendarFeed = async (): Promise<void> => {
    if (!calendarFeedUrl) return
    await navigator.clipboard.writeText(calendarFeedUrl.replace(/^webcal:\/\//, 'https://'))
    setCalendarCopied(true)
    setTimeout(() => setCalendarCopied(false), 2000)
  }

  const onResetCalendarFeed = async (): Promise<void> => {
    if (!confirm('Reset the calendar link? Anyone subscribed with the old link will stop getting updates.')) {
      return
    }
    setCalendarResetting(true)
    try {
      setCalendarFeedUrl(await window.api.settings.resetCalendarFeedToken())
    } finally {
      setCalendarResetting(false)
    }
  }

  const onExportContacts = async (): Promise<void> => {
    setExportingContacts(true)
    setExportMessage(null)
    try {
      const result = await window.api.export.contacts()
      setExportMessage(result.ok ? `Saved to ${result.path}` : null)
    } finally {
      setExportingContacts(false)
    }
  }

  const onExportInvoices = async (): Promise<void> => {
    setExportingInvoices(true)
    setExportMessage(null)
    try {
      const result = await window.api.export.invoices()
      setExportMessage(result.ok ? `Saved to ${result.path}` : null)
    } finally {
      setExportingInvoices(false)
    }
  }

  const onAddTeammate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setTeammateSaving(true)
    setTeammateError(null)
    try {
      await window.api.auth.createUser(
        teammateForm.email.trim(),
        teammateForm.password,
        teammateForm.name.trim()
      )
      setTeammateForm({ name: '', email: '', password: '' })
      setAddingTeammate(false)
      setTeam(await window.api.users.list())
    } catch (err) {
      setTeammateError(err instanceof Error ? err.message : String(err))
    } finally {
      setTeammateSaving(false)
    }
  }

  const onRemoveTeammate = async (id: string): Promise<void> => {
    if (!confirm('Remove this teammate\'s account? They will no longer be able to log in.')) return
    await window.api.users.delete(id)
    setTeam(await window.api.users.list())
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Email accounts</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Connect one or more mailboxes (e.g. info@ and sales@ for your company). All of them
              sync into the same Email inbox and contact list. Credentials are encrypted and never
              leave this machine.
            </p>
          </div>
          {editingAccountId === null && (
            <button
              onClick={onAddAccount}
              className="flex-shrink-0 rounded border border-neutral-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              + Add account
            </button>
          )}
        </div>

        {accounts.length > 0 && (
          <div className="mt-4 divide-y divide-neutral-800 rounded border border-neutral-800">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-sm text-white">{account.label}</p>
                  <p className="text-xs text-neutral-500">
                    {account.user} @ {account.host}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => onEditAccount(account)}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteAccount(account.id)}
                    className="text-xs text-red-400/70 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {accounts.length === 0 && editingAccountId === null && (
          <p className="mt-4 text-xs text-neutral-500">No email accounts connected yet.</p>
        )}

        {editingAccountId !== null && (
          <div className="mt-4 border-t border-neutral-800 pt-4">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Label</label>
              <input
                value={accountForm.label}
                onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })}
                placeholder="e.g. Sales, Support"
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">IMAP host</label>
                <input
                  value={accountForm.host}
                  onChange={(e) => setAccountForm({ ...accountForm, host: e.target.value })}
                  placeholder="mail.unifiedintegrationpa.com"
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Port</label>
                <input
                  type="number"
                  value={accountForm.port}
                  onChange={(e) => setAccountForm({ ...accountForm, port: Number(e.target.value) })}
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-400">Username / email</label>
                <input
                  value={accountForm.user}
                  onChange={(e) => setAccountForm({ ...accountForm, user: e.target.value })}
                  placeholder="info@unifiedintegrationpa.com"
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-400">
                  Password (app-specific if available)
                  {editingAccountId !== 'new' && ' — leave blank to keep the current one'}
                </label>
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-400">
                <input
                  type="checkbox"
                  checked={accountForm.secure}
                  onChange={(e) => setAccountForm({ ...accountForm, secure: e.target.checked })}
                />
                Use SSL/TLS (recommended, usually port 993)
              </label>
            </div>

            <div className="mt-5 border-t border-neutral-800 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Sending (SMTP)
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Needed to reply to or compose emails from this account. Same login as above — just
                a different server/port for sending.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">SMTP host</label>
                  <input
                    value={accountForm.smtpHost}
                    onChange={(e) => setAccountForm({ ...accountForm, smtpHost: e.target.value })}
                    placeholder={accountForm.host || 'mail.unifiedintegrationpa.com'}
                    className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">Port</label>
                  <input
                    type="number"
                    value={accountForm.smtpPort}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, smtpPort: Number(e.target.value) })
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                  />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-400">
                  <input
                    type="checkbox"
                    checked={accountForm.smtpSecure}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, smtpSecure: e.target.checked })
                    }
                  />
                  Use SSL (port 465) — leave unchecked for STARTTLS (usually port 587)
                </label>
              </div>
            </div>

            {testResult && (
              <p className={`mt-3 text-xs ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.ok ? 'Connection successful.' : `Failed: ${testResult.error}`}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={onTestAccount}
                disabled={testing || !accountForm.host || !accountForm.user || !accountForm.password}
                className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              <button
                onClick={onSaveAccount}
                disabled={
                  savingAccount ||
                  !accountForm.host ||
                  !accountForm.user ||
                  (editingAccountId === 'new' && !accountForm.password)
                }
                className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
              >
                {savingAccount ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={onCancelAccountForm}
                className="rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white">Sync</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Syncs automatically every 10 minutes while the app is open, plus on launch. You can also
          trigger it manually.
        </p>
        <button
          onClick={onSyncNow}
          disabled={syncing || accounts.length === 0}
          className="mt-3 rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {syncResult && (
          <div className="mt-3 text-xs text-neutral-400">
            {syncResult.ok ? (
              <p>
                Fetched {syncResult.fetched} message(s) — {syncResult.leadsCreated} new lead(s),{' '}
                {syncResult.emailsLinked} linked, {syncResult.unmatched} unrecognized.
              </p>
            ) : (
              <p className="text-red-400">{syncResult.error}</p>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white">Square (invoicing)</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Connect your Square account to send invoices straight from a contact's page — the CRM
          computes tax and publishes/emails the invoice to the client immediately. It can also pull
          in customers and invoices you already have in Square. Get an access token from your
          Square Developer Dashboard.
        </p>

        {squareCurrent && (
          <p className="mt-3 rounded bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            Connected: {squareCurrent.environment}
            {squareCurrent.locationName ? ` — ${squareCurrent.locationName}` : ''}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div className="flex gap-4 text-sm text-neutral-300">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={squareForm.environment === 'production'}
                onChange={() => setSquareForm({ ...squareForm, environment: 'production', locationId: '' })}
              />
              Production (real invoices, real payments)
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={squareForm.environment === 'sandbox'}
                onChange={() => setSquareForm({ ...squareForm, environment: 'sandbox', locationId: '' })}
              />
              Sandbox (testing only)
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Access token</label>
            <input
              type="password"
              value={squareForm.accessToken}
              onChange={(e) => setSquareForm({ ...squareForm, accessToken: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>

          {squareTestResult?.ok && squareTestResult.locations && (
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Location</label>
              <select
                value={squareForm.locationId}
                onChange={(e) => setSquareForm({ ...squareForm, locationId: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                {squareTestResult.locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {squareTestResult && (
          <p className={`mt-3 text-xs ${squareTestResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {squareTestResult.ok
              ? `Connection successful — found ${squareTestResult.locations?.length ?? 0} location(s).`
              : `Failed: ${squareTestResult.error}`}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onTestSquare}
            disabled={squareTesting || !squareForm.accessToken}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {squareTesting ? 'Testing…' : 'Test connection'}
          </button>
          <button
            onClick={onSaveSquare}
            disabled={squareSaving || !squareForm.accessToken || !squareForm.locationId}
            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            {squareSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {squareCurrent && (
          <div className="mt-5 border-t border-neutral-800 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Import from Square
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Pulls in every customer and invoice already in Square that this app didn't create.
              Safe to run repeatedly — it never creates duplicates.
            </p>
            <button
              onClick={onSyncSquare}
              disabled={squareSyncing}
              className="mt-3 rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {squareSyncing ? 'Importing…' : 'Import now'}
            </button>
            {squareSyncResult && (
              <div className="mt-3 text-xs text-neutral-400">
                {squareSyncResult.ok ? (
                  <p>
                    {squareSyncResult.customersCreated} new contact
                    {squareSyncResult.customersCreated === 1 ? '' : 's'},{' '}
                    {squareSyncResult.customersLinked} matched to existing contacts,{' '}
                    {squareSyncResult.invoicesCreated} new invoice
                    {squareSyncResult.invoicesCreated === 1 ? '' : 's'} imported (
                    {squareSyncResult.invoicesUpdated} already known, statuses refreshed).
                  </p>
                ) : (
                  <p className="text-red-400">{squareSyncResult.error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white">Estimate signing page</h2>
        <p className="mt-1 text-xs text-neutral-500">
          The public web address where clients view and sign estimates you send them. Set this
          once you've deployed the signing page.
        </p>

        {portalUrlSaved && (
          <p className="mt-3 rounded bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            Connected: {portalUrlSaved}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <input
            value={portalUrl}
            onChange={(e) => setPortalUrl(e.target.value)}
            placeholder="https://unified-integration-estimates.vercel.app"
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
          />
          <button
            onClick={onSavePortalUrl}
            disabled={portalSaving || !portalUrl.trim()}
            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            {portalSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white">Job calendar</h2>
        <p className="mt-1 text-xs text-neutral-500">
          A live calendar feed of every scheduled task — subscribe once from your phone or Mac's
          Calendar app and new jobs show up automatically, no re-importing.
        </p>

        {!portalUrlSaved && (
          <p className="mt-3 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Set up the estimate signing page above first — the calendar feed is served from the
            same address.
          </p>
        )}

        {calendarFeedUrl && (
          <>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={calendarFeedUrl.replace(/^webcal:\/\//, 'https://')}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300 outline-none"
              />
              <button
                onClick={onCopyCalendarFeed}
                className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
              >
                {calendarCopied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={calendarFeedUrl}
                className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
              >
                Add to Calendar
              </a>
              <button
                onClick={onResetCalendarFeed}
                disabled={calendarResetting}
                className="text-xs text-red-400/70 hover:text-red-400 disabled:opacity-40"
              >
                {calendarResetting ? 'Resetting…' : 'Reset link'}
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-600">
              On iPhone: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed
              Calendar, then paste the link above.
            </p>
          </>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white">Export data</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Save your contacts or invoices as a CSV file you can open in Excel, Numbers, or Google
          Sheets.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onExportContacts}
            disabled={exportingContacts}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {exportingContacts ? 'Exporting…' : 'Export contacts (CSV)'}
          </button>
          <button
            onClick={onExportInvoices}
            disabled={exportingInvoices}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {exportingInvoices ? 'Exporting…' : 'Export invoices (CSV)'}
          </button>
        </div>
        {exportMessage && <p className="mt-3 text-xs text-emerald-400">{exportMessage}</p>}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white">Team</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Everyone added here can log into this app on any connected Mac with their own email and
          password.
        </p>

        <div className="mt-4 divide-y divide-neutral-800 rounded border border-neutral-800">
          {team.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-sm text-white">
                  {member.name}{' '}
                  <span className="text-xs text-neutral-500">
                    {member.role === 'owner' ? '(owner)' : ''}
                  </span>
                </p>
                <p className="text-xs text-neutral-500">{member.email}</p>
              </div>
              {team.length > 1 && (
                <button
                  onClick={() => onRemoveTeammate(member.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {team.length === 0 && (
            <p className="px-3 py-3 text-xs text-neutral-500">No accounts yet.</p>
          )}
        </div>

        {addingTeammate ? (
          <form onSubmit={onAddTeammate} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Name</label>
              <input
                autoFocus
                value={teammateForm.name}
                onChange={(e) => setTeammateForm({ ...teammateForm, name: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Email</label>
              <input
                type="email"
                value={teammateForm.email}
                onChange={(e) => setTeammateForm({ ...teammateForm, email: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Password</label>
              <input
                type="password"
                value={teammateForm.password}
                onChange={(e) => setTeammateForm({ ...teammateForm, password: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Have your teammate set this themselves, or choose one and share it with them
                directly — at least 6 characters.
              </p>
            </div>
            {teammateError && <p className="text-xs text-red-400">{teammateError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  teammateSaving ||
                  !teammateForm.name.trim() ||
                  !teammateForm.email.trim() ||
                  teammateForm.password.length < 6
                }
                className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
              >
                {teammateSaving ? 'Adding…' : 'Add teammate'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingTeammate(false)
                  setTeammateError(null)
                }}
                className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingTeammate(true)}
            className="mt-4 rounded border border-neutral-700 px-3 py-1.5 text-sm text-white"
          >
            + Add teammate
          </button>
        )}
      </section>
    </div>
  )
}
