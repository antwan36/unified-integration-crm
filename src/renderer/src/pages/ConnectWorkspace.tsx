import { useState } from 'react'
import { cleanIpcError } from '../lib/errors'
import logoMark from '../assets/logo-mark.png'

export default function ConnectWorkspace({
  onConnected
}: {
  onConnected: () => void
}): React.JSX.Element {
  const [connectionString, setConnectionString] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await window.api.workspace.test(connectionString))
    } finally {
      setTesting(false)
    }
  }

  const onConnect = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setConnecting(true)
    setError(null)
    try {
      const result = await window.api.workspace.connect(connectionString, passphrase)
      if (result.ok) {
        onConnected()
      } else {
        setError(result.error ?? 'Could not connect.')
      }
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <form
        onSubmit={onConnect}
        className="w-full max-w-md space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8"
      >
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <img src={logoMark} alt="" className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-white">Connect your workspace</h1>
          <p className="mt-1 text-sm text-neutral-400">
            The CRM stores its data in a shared database so it stays in sync across every Mac you
            use it on. If this is the first machine, paste your new database's connection string
            and pick a passphrase. Adding another machine? Use the exact same connection string
            and passphrase you used the first time.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">
            Database connection string
          </label>
          <input
            type="password"
            required
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="postgresql://user:password@host/dbname?sslmode=require"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">
            Workspace passphrase
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Protects IMAP/Square credentials in the shared database"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Not stored anywhere but this Mac's Keychain — write it down, you'll need it to add
            another machine later.
          </p>
        </div>

        {testResult && (
          <p className={`text-sm ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResult.ok ? 'Connection successful.' : `Failed: ${testResult.error}`}
          </p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onTest}
            disabled={testing || !connectionString}
            className="flex-1 rounded border border-neutral-700 py-2 text-sm text-white disabled:opacity-40"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button
            type="submit"
            disabled={connecting || !connectionString || passphrase.length < 8}
            className="flex-1 rounded bg-primary py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </form>
    </div>
  )
}
