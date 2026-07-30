import { getDb } from './index'
import { newId } from './ids'
import type { ReviewRequestWithDetails } from '../../shared/types'

/**
 * Queues a review request for a newly-paid invoice. Idempotent — the UNIQUE
 * constraint on invoiceId means a repeated Square sync (background poll or
 * manual refresh) never creates a duplicate for the same invoice.
 */
export async function queueReviewRequest(contactId: string, invoiceId: string): Promise<void> {
  await getDb().query(
    `INSERT INTO review_requests (id, "contactId", "invoiceId")
     VALUES ($1, $2, $3)
     ON CONFLICT ("invoiceId") DO NOTHING`,
    [newId(), contactId, invoiceId]
  )
}

export async function listQueuedReviewRequests(): Promise<ReviewRequestWithDetails[]> {
  const result = await getDb().query<ReviewRequestWithDetails>(
    `SELECT rr.*, c.name AS "contactName", c.email AS "contactEmail", i.title AS "invoiceTitle"
     FROM review_requests rr
     JOIN contacts c ON c.id = rr."contactId"
     JOIN invoices i ON i.id = rr."invoiceId"
     WHERE rr.status = 'queued'
     ORDER BY rr."queuedAt" ASC`
  )
  return result.rows
}

export async function countQueuedReviewRequests(): Promise<number> {
  const result = await getDb().query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM review_requests WHERE status = 'queued'`
  )
  return Number(result.rows[0]?.count ?? 0)
}

export async function getReviewRequest(id: string): Promise<ReviewRequestWithDetails | null> {
  const result = await getDb().query<ReviewRequestWithDetails>(
    `SELECT rr.*, c.name AS "contactName", c.email AS "contactEmail", i.title AS "invoiceTitle"
     FROM review_requests rr
     JOIN contacts c ON c.id = rr."contactId"
     JOIN invoices i ON i.id = rr."invoiceId"
     WHERE rr.id = $1`,
    [id]
  )
  return result.rows[0] ?? null
}

export async function markReviewRequestSent(id: string): Promise<void> {
  await getDb().query(
    `UPDATE review_requests SET status = 'sent', "sentAt" = now() WHERE id = $1`,
    [id]
  )
}

export async function dismissReviewRequest(id: string): Promise<void> {
  await getDb().query(
    `UPDATE review_requests SET status = 'dismissed', "dismissedAt" = now() WHERE id = $1`,
    [id]
  )
}
