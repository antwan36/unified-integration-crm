import { getValidQuickBooksCredentials } from './client'
import { ensureQuickBooksCustomer } from './customers'
import { createQuickBooksInvoiceFromLocal, recordQuickBooksPayment } from './invoices'
import { listAllInvoices, getInvoice, setQuickBooksInvoiceId } from '../db/invoices'
import type { QuickBooksSyncResult } from '../../shared/types'

const DRAFT_STATUSES = ['DRAFT']

/**
 * One-time/on-demand push of every existing local invoice (which already mirrors Square,
 * via runSquareSync or invoices created in-app) into QuickBooks as historical Customers +
 * Invoices + Payments, so QuickBooks ends up with the full revenue record. Safe to re-run —
 * skips any invoice that already has a quickbooksInvoiceId, so nothing is duplicated and a
 * failed/interrupted run can just be re-triggered to pick up where it left off. Drafts are
 * skipped since they were never actually billed. Square-side refunds are noted in each
 * invoice's PrivateNote but not modeled as a real QuickBooks refund transaction — see
 * invoices.ts.
 */
export async function runQuickBooksMigration(): Promise<QuickBooksSyncResult> {
  let creds: Awaited<ReturnType<typeof getValidQuickBooksCredentials>>
  try {
    creds = await getValidQuickBooksCredentials()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      customersMatched: 0,
      invoicesCreated: 0,
      invoicesSkipped: 0,
      paymentsRecorded: 0
    }
  }

  const invoices = await listAllInvoices()
  let customersMatched = 0
  let invoicesCreated = 0
  let invoicesSkipped = 0
  let paymentsRecorded = 0

  for (const summary of invoices) {
    if (summary.quickbooksInvoiceId || DRAFT_STATUSES.includes(summary.status)) {
      invoicesSkipped++
      continue
    }

    try {
      const full = await getInvoice(summary.id)
      if (!full) {
        invoicesSkipped++
        continue
      }

      const qboCustomerId = await ensureQuickBooksCustomer(creds.realmId, full.contactId)
      customersMatched++

      const noteParts = [`Migrated from Square${full.squareInvoiceId ? ` (invoice ${full.squareInvoiceId})` : ''}.`]
      if (full.refundedCents > 0) {
        noteParts.push(
          `$${(full.refundedCents / 100).toFixed(2)} was refunded in Square — not recorded here as a QuickBooks refund transaction; adjust manually if needed.`
        )
      }

      const qboInvoice = await createQuickBooksInvoiceFromLocal(
        creds.realmId,
        qboCustomerId,
        full,
        noteParts.join(' ')
      )
      await setQuickBooksInvoiceId(full.id, qboInvoice.Id)
      invoicesCreated++

      if (full.paidCents > 0) {
        await recordQuickBooksPayment(
          creds.realmId,
          qboCustomerId,
          qboInvoice.Id,
          full.paidCents,
          full.createdAt.slice(0, 10)
        )
        paymentsRecorded++
      }
    } catch (err) {
      console.error(`Failed to migrate invoice ${summary.id} to QuickBooks:`, err)
      invoicesSkipped++
    }
  }

  return { ok: true, customersMatched, invoicesCreated, invoicesSkipped, paymentsRecorded }
}
