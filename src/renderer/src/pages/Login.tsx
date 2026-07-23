import { useState } from 'react'
import { useAuth } from '../state/auth'
import logoMark from '../assets/logo-mark.png'

export default function Login(): React.JSX.Element {
  const { hasUser, login, setup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (hasUser) {
        const result = await login(email, password)
        if (!result) setError('Incorrect email or password.')
      } else {
        await setup(email, password, name || 'Owner')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
            <img src={logoMark} alt="" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Unified Integration CRM</h1>
            <p className="mt-0.5 text-sm text-neutral-400">
              {hasUser ? 'Sign in to continue' : 'Create your account to get started'}
            </p>
          </div>
        </div>

        {!hasUser && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Your name</label>
            <input
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anthony Sell"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Email</label>
          <input
            type="email"
            required
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Password</label>
          <input
            type="password"
            required
            minLength={hasUser ? undefined : 6}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-primary"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-primary py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {hasUser ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
