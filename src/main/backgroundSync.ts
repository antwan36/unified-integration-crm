import { Notification } from 'electron'
import { runImapSyncAll } from './imap/sync'
import { listEmailAccounts } from './db/emailAccounts'
import { runSquareSync } from './square/sync'
import { hasSquareCredentials } from './secrets/square-credentials'

const SYNC_INTERVAL_MS = 10 * 60 * 1000

let started = false

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}

export function scheduleBackgroundSync(): void {
  if (started) return
  started = true

  const kickOff = async (): Promise<void> => {
    if ((await listEmailAccounts()).length > 0) {
      runImapSyncAll()
        .then((result) => {
          if (result.ok && result.leadsCreated > 0) {
            notify(
              result.leadsCreated === 1 ? 'New lead' : `${result.leadsCreated} new leads`,
              result.leadsCreated === 1
                ? 'A new lead came in by email.'
                : `${result.leadsCreated} new leads came in by email.`
            )
          }
        })
        .catch((err) => console.error('IMAP sync failed:', err))
    }
    if (await hasSquareCredentials()) {
      runSquareSync()
        .then((result) => {
          if (!result.ok) {
            console.error('Square sync failed:', result.error)
            return
          }
          if (result.invoicesPaid > 0) {
            notify(
              result.invoicesPaid === 1 ? 'Invoice paid' : `${result.invoicesPaid} invoices paid`,
              result.invoicesPaid === 1
                ? 'A customer paid their invoice.'
                : `${result.invoicesPaid} customers paid their invoices.`
            )
          }
        })
        .catch((err) => console.error('Square sync failed:', err))
    }
  }
  setTimeout(kickOff, 5000)
  setInterval(kickOff, SYNC_INTERVAL_MS)
}
