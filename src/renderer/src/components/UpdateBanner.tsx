import { useEffect, useState } from 'react'
import type { UpdateCheckResult } from '../../../shared/types'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

type Phase = 'idle' | 'available' | 'installing' | 'error'

export default function UpdateBanner(): React.JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const check = (): void => {
      window.api.updates.check().then((res) => {
        setResult(res)
        if (res.updateAvailable) setPhase('available')
      })
    }
    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const onInstall = async (): Promise<void> => {
    if (!result?.downloadUrl) return
    setPhase('installing')
    setError(null)
    const res = await window.api.updates.install(result.downloadUrl)
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong installing the update.')
      setPhase('error')
    }
    // On success the app quits itself shortly after — no further state change needed here.
  }

  if (dismissed || phase === 'idle' || !result) return null

  return (
    <div className="flex items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm">
      {phase === 'available' && (
        <>
          <span className="text-primary">
            Update available — v{result.latestVersion} (you're on v{result.currentVersion})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onInstall}
              className="rounded bg-primary px-3 py-1 text-xs font-semibold text-black hover:bg-primary/90"
            >
              Update & Restart
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Later
            </button>
          </div>
        </>
      )}
      {phase === 'installing' && (
        <span className="text-primary">
          Downloading v{result.latestVersion}… the app will quit and reopen automatically once it's
          ready.
        </span>
      )}
      {phase === 'error' && (
        <>
          <span className="text-red-400">Update failed: {error}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onInstall}
              className="rounded border border-neutral-700 px-3 py-1 text-xs text-white hover:bg-neutral-800"
            >
              Retry
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  )
}
