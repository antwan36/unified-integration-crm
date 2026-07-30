import { getDb } from './index'
import { newId } from './ids'
import type {
  CreateInvoiceLineItemInput,
  Invoice,
  InvoiceAnalytics,
  InvoiceLineItem,
  InvoiceStats,
  InvoiceStatus,
  InvoiceWithContactName,
  InvoiceWithLineItems
} from '../../shared/types'

const OUTSTANDING_STATUSES = ['UNPAID', 'SCHEDULED', 'PARTIALLY_PAID', 'PAYMENT_PENDING', 'FAILED']

interface InvoiceRow {
  id: string
  contactId: string
  squareInvoiceId: string | null
  squareOrderId: string | null
  title: string
  dueDate: string
  subtotalCents: number
  taxPercent: number
  shippingCents: number
  totalCents: number
  paidCents: number
  refundedCents: number
  costCents: number
  status: string
  invoiceNumber: string | null
  publicUrl: string | null
  createdAt: Date
  updatedAt: Date
}

interface LineItemRow {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unitPriceCents: number
  link: string | null
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    contactId: row.contactId,
    squareInvoiceId: row.squareInvoiceId,
    squareOrderId: row.squareOrderId,
    title: row.title,
    dueDate: row.dueDate,
    subtotalCents: row.subtotalCents,
    taxPercent: row.taxPercent,
    shippingCents: row.shippingCents,
    totalCents: row.totalCents,
    paidCents: row.paidCents,
    refundedCents: row.refundedCents,
    costCents: row.costCents,
    status: row.status as InvoiceStatus,
    invoiceNumber: row.invoiceNumber,
    publicUrl: row.publicUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function toLineItem(row: LineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    description: row.description,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    link: row.link
  }
}

export async function listInvoicesForContact(contactId: string): Promise<Invoice[]> {
  const result = await getDb().query<InvoiceRow>(
    'SELECT * FROM invoices WHERE "contactId" = $1 ORDER BY "createdAt" DESC',
    [contactId]
  )
  return result.rows.map(toInvoice)
}

export async function listAllInvoices(): Promise<InvoiceWithContactName[]> {
  const result = await getDb().query<InvoiceRow & { contactName: string }>(
    `SELECT i.*, c.name as "contactName"
     FROM invoices i JOIN contacts c ON c.id = i."contactId"
     ORDER BY i."createdAt" DESC`
  )
  return result.rows.map((row) => ({ ...toInvoice(row), contactName: row.contactName }))
}

export async function getInvoice(id: string): Promise<InvoiceWithLineItems | null> {
  const result = await getDb().query<InvoiceRow>('SELECT * FROM invoices WHERE id = $1', [id])
  const row = result.rows[0]
  if (!row) return null
  const lineItems = await getDb().query<LineItemRow>(
    'SELECT * FROM invoice_line_items WHERE "invoiceId" = $1 ORDER BY "sortOrder" ASC',
    [id]
  )
  return { ...toInvoice(row), lineItems: lineItems.rows.map(toLineItem) }
}

export async function getInvoiceStats(): Promise<InvoiceStats> {
  const result = await getDb().query<{
    outstandingCents: string
    outstandingCount: string
    paidCents: string
    paidCount: string
    overdueCents: string
    overdueCount: string
  }>(
    `SELECT
      COALESCE(SUM("totalCents") FILTER (WHERE status = ANY($1)), 0) AS "outstandingCents",
      COUNT(*) FILTER (WHERE status = ANY($1)) AS "outstandingCount",
      COALESCE(SUM("totalCents") FILTER (WHERE status = 'PAID'), 0) AS "paidCents",
      COUNT(*) FILTER (WHERE status = 'PAID') AS "paidCount",
      COALESCE(SUM("totalCents") FILTER (WHERE status = ANY($1) AND "dueDate" < to_char(now(), 'YYYY-MM-DD')), 0) AS "overdueCents",
      COUNT(*) FILTER (WHERE status = ANY($1) AND "dueDate" < to_char(now(), 'YYYY-MM-DD')) AS "overdueCount"
     FROM invoices`,
    [OUTSTANDING_STATUSES]
  )
  const row = result.rows[0]
  return {
    outstandingCents: Number(row.outstandingCents),
    outstandingCount: Number(row.outstandingCount),
    paidCents: Number(row.paidCents),
    paidCount: Number(row.paidCount),
    overdueCents: Number(row.overdueCents),
    overdueCount: Number(row.overdueCount)
  }
}

const NON_BILLED_STATUSES = ['DRAFT', 'CANCELED']

export async function getInvoiceAnalytics(): Promise<InvoiceAnalytics> {
  const db = getDb()

  const [totalsRes, byStatusRes, monthlyRes] = await Promise.all([
    db.query<{
      totalInvoicedCents: string
      totalInvoicedCount: string
      totalCollectedCents: string
      totalCostCents: string
      costedInvoiceCount: string
    }>(
      `SELECT
        COALESCE(SUM("totalCents") FILTER (WHERE status != ALL($1)), 0) AS "totalInvoicedCents",
        COUNT(*) FILTER (WHERE status != ALL($1)) AS "totalInvoicedCount",
        COALESCE(SUM("paidCents"), 0) AS "totalCollectedCents",
        COALESCE(SUM("costCents") FILTER (WHERE status != ALL($1)), 0) AS "totalCostCents",
        COUNT(*) FILTER (WHERE status != ALL($1) AND "costCents" > 0) AS "costedInvoiceCount"
       FROM invoices`,
      [NON_BILLED_STATUSES]
    ),
    db.query<{ status: string; count: string; totalCents: string }>(
      `SELECT status, COUNT(*) as count, COALESCE(SUM("totalCents"), 0) as "totalCents"
       FROM invoices GROUP BY status`
    ),
    db.query<{ month: string; invoicedCents: string; count: string }>(
      `SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
        COALESCE(SUM("totalCents"), 0) as "invoicedCents",
        COUNT(*) as count
       FROM invoices
       WHERE status != ALL($1) AND "createdAt" >= date_trunc('month', now()) - interval '11 months'
       GROUP BY month`,
      [NON_BILLED_STATUSES]
    )
  ])

  const totals = totalsRes.rows[0]
  const totalInvoicedCents = Number(totals.totalInvoicedCents)
  const totalInvoicedCount = Number(totals.totalInvoicedCount)
  const totalCostCents = Number(totals.totalCostCents)

  const monthlyByKey = new Map(
    monthlyRes.rows.map((r) => [r.month, { invoicedCents: Number(r.invoicedCents), count: Number(r.count) }])
  )
  const monthly: InvoiceAnalytics['monthly'] = []
  const cursor = new Date()
  cursor.setDate(1)
  cursor.setMonth(cursor.getMonth() - 11)
  for (let i = 0; i < 12; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const point = monthlyByKey.get(key)
    monthly.push({ month: key, invoicedCents: point?.invoicedCents ?? 0, count: point?.count ?? 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return {
    totalInvoicedCents,
    totalInvoicedCount,
    totalCollectedCents: Number(totals.totalCollectedCents),
    averageInvoiceCents: totalInvoicedCount > 0 ? Math.round(totalInvoicedCents / totalInvoicedCount) : 0,
    totalCostCents,
    totalProfitCents: totalInvoicedCents - totalCostCents,
    costedInvoiceCount: Number(totals.costedInvoiceCount),
    byStatus: byStatusRes.rows
      .map((r) => ({
        status: r.status as InvoiceStatus,
        count: Number(r.count),
        totalCents: Number(r.totalCents)
      }))
      .sort((a, b) => b.totalCents - a.totalCents),
    monthly
  }
}

export interface CreateInvoiceRecordInput {
  contactId: string
  squareInvoiceId: string | null
  squareOrderId: string | null
  title: string
  dueDate: string
  subtotalCents: number
  taxPercent: number
  shippingCents: number
  totalCents: number
  status: InvoiceStatus
  invoiceNumber: string | null
  publicUrl: string | null
  lineItems: CreateInvoiceLineItemInput[]
}

export async function createInvoiceRecord(
  input: CreateInvoiceRecordInput
): Promise<InvoiceWithLineItems> {
  const id = newId()
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO invoices
        (id, "contactId", "squareInvoiceId", "squareOrderId", title, "dueDate", "subtotalCents", "taxPercent", "shippingCents", "totalCents", status, "invoiceNumber", "publicUrl")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        input.contactId,
        input.squareInvoiceId,
        input.squareOrderId,
        input.title,
        input.dueDate,
        input.subtotalCents,
        input.taxPercent,
        input.shippingCents,
        input.totalCents,
        input.status,
        input.invoiceNumber,
        input.publicUrl
      ]
    )
    let sortOrder = 0
    for (const item of input.lineItems) {
      await client.query(
        `INSERT INTO invoice_line_items (id, "invoiceId", description, quantity, "unitPriceCents", "sortOrder", "link")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newId(), id, item.description, item.quantity, item.unitPriceCents, sortOrder++, item.link ?? null]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return (await getInvoice(id))!
}

export interface UpsertInvoiceFromSquareInput {
  contactId: string
  squareInvoiceId: string
  squareOrderId: string | null
  title: string
  dueDate: string
  subtotalCents: number
  taxPercent: number
  shippingCents: number
  totalCents: number
  paidCents: number
  refundedCents: number
  status: InvoiceStatus
  invoiceNumber: string | null
  publicUrl: string | null
  lineItems: CreateInvoiceLineItemInput[]
}

/**
 * Imports or refreshes an invoice that originated in Square. Line items are only
 * written on first import — Square invoices don't change line items once issued.
 */
export async function upsertInvoiceFromSquare(
  input: UpsertInvoiceFromSquareInput
): Promise<{ id: string; inserted: boolean; becamePaid: boolean }> {
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    const prev = await client.query<{ status: string }>(
      `SELECT status FROM invoices WHERE "squareInvoiceId" = $1`,
      [input.squareInvoiceId]
    )
    const previousStatus = prev.rows[0]?.status ?? null
    const result = await client.query<{ id: string; inserted: boolean }>(
      `INSERT INTO invoices
        (id, "contactId", "squareInvoiceId", "squareOrderId", title, "dueDate", "subtotalCents", "taxPercent", "shippingCents", "totalCents", "paidCents", "refundedCents", status, "invoiceNumber", "publicUrl")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT ("squareInvoiceId") DO UPDATE SET
         status = EXCLUDED.status,
         "paidCents" = EXCLUDED."paidCents",
         "refundedCents" = EXCLUDED."refundedCents",
         "invoiceNumber" = COALESCE(EXCLUDED."invoiceNumber", invoices."invoiceNumber"),
         "publicUrl" = COALESCE(EXCLUDED."publicUrl", invoices."publicUrl"),
         "updatedAt" = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        newId(),
        input.contactId,
        input.squareInvoiceId,
        input.squareOrderId,
        input.title,
        input.dueDate,
        input.subtotalCents,
        input.taxPercent,
        input.shippingCents,
        input.totalCents,
        input.paidCents,
        input.refundedCents,
        input.status,
        input.invoiceNumber,
        input.publicUrl
      ]
    )
    const { id, inserted } = result.rows[0]
    if (inserted) {
      let sortOrder = 0
      for (const item of input.lineItems) {
        await client.query(
          `INSERT INTO invoice_line_items (id, "invoiceId", description, quantity, "unitPriceCents", "sortOrder", "link")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [newId(), id, item.description, item.quantity, item.unitPriceCents, sortOrder++, item.link ?? null]
        )
      }
    }
    await client.query('COMMIT')
    const becamePaid = input.status === 'PAID' && previousStatus !== 'PAID'
    return { id, inserted, becamePaid }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function deleteInvoiceRecord(id: string): Promise<void> {
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    // An estimate converted into this invoice goes back to plain "signed".
    await client.query(
      `UPDATE estimates SET "invoiceId" = NULL, status = 'signed', "updatedAt" = now() WHERE "invoiceId" = $1`,
      [id]
    )
    await client.query('DELETE FROM invoices WHERE id = $1', [id])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  invoiceNumber: string | null,
  publicUrl: string | null,
  paidCents: number,
  refundedCents: number
): Promise<void> {
  await getDb().query(
    `UPDATE invoices SET status = $1, "invoiceNumber" = COALESCE($2, "invoiceNumber"),
      "publicUrl" = COALESCE($3, "publicUrl"), "paidCents" = $4, "refundedCents" = $5, "updatedAt" = now()
     WHERE id = $6`,
    [status, invoiceNumber, publicUrl, paidCents, refundedCents, id]
  )
}

/**
 * Internal-only cost entry for the profit view — never touches Square, so it's
 * editable regardless of invoice status (you often don't know final cost until
 * after the job, well after the invoice was sent or paid).
 */
export async function updateInvoiceCost(id: string, costCents: number): Promise<Invoice | null> {
  const result = await getDb().query<InvoiceRow>(
    `UPDATE invoices SET "costCents" = $1, "updatedAt" = now() WHERE id = $2 RETURNING *`,
    [costCents, id]
  )
  return result.rows[0] ? toInvoice(result.rows[0]) : null
}
