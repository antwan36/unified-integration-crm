import { randomBytes } from 'crypto'
import type { PoolClient } from 'pg'
import { getDb } from './index'
import { newId } from './ids'
import type {
  CreateEstimateInput,
  Estimate,
  EstimateItem,
  EstimateStatus,
  EstimateWithContactName,
  EstimateWithItems,
  UpdateEstimateInput
} from '../../shared/types'

interface EstimateRow {
  id: string
  contactId: string
  title: string
  status: string
  taxPercent: number
  signToken: string | null
  signerName: string | null
  signedAt: Date | null
  sentAt: Date | null
  invoiceId: string | null
  createdAt: Date
  updatedAt: Date
}

interface EstimateItemRow {
  id: string
  estimateId: string
  description: string
  quantity: number
  unitPriceCents: number
}

function toEstimate(row: EstimateRow): Estimate {
  return {
    id: row.id,
    contactId: row.contactId,
    title: row.title,
    status: row.status as EstimateStatus,
    taxPercent: row.taxPercent,
    signToken: row.signToken,
    signerName: row.signerName,
    signedAt: row.signedAt ? row.signedAt.toISOString() : null,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    invoiceId: row.invoiceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function toItem(row: EstimateItemRow): EstimateItem {
  return {
    id: row.id,
    estimateId: row.estimateId,
    description: row.description,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents
  }
}

async function replaceItems(
  client: PoolClient,
  estimateId: string,
  items: { description: string; quantity: number; unitPriceCents: number }[]
): Promise<void> {
  await client.query('DELETE FROM estimate_items WHERE "estimateId" = $1', [estimateId])
  let sortOrder = 0
  for (const item of items) {
    await client.query(
      `INSERT INTO estimate_items (id, "estimateId", description, quantity, "unitPriceCents", "sortOrder")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId(), estimateId, item.description, item.quantity, item.unitPriceCents, sortOrder++]
    )
  }
}

export async function createEstimate(input: CreateEstimateInput): Promise<EstimateWithItems> {
  const id = newId()
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO estimates (id, "contactId", title, "taxPercent")
       VALUES ($1, $2, $3, $4)`,
      [id, input.contactId, input.title, input.taxPercent]
    )
    await replaceItems(client, id, input.items)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return (await getEstimate(id))!
}

export async function getEstimate(id: string): Promise<EstimateWithItems | null> {
  const result = await getDb().query<EstimateRow>('SELECT * FROM estimates WHERE id = $1', [id])
  const row = result.rows[0]
  if (!row) return null
  const items = await getDb().query<EstimateItemRow>(
    'SELECT * FROM estimate_items WHERE "estimateId" = $1 ORDER BY "sortOrder" ASC',
    [id]
  )
  return { ...toEstimate(row), items: items.rows.map(toItem) }
}

export async function listEstimatesForContact(contactId: string): Promise<Estimate[]> {
  const result = await getDb().query<EstimateRow>(
    'SELECT * FROM estimates WHERE "contactId" = $1 ORDER BY "createdAt" DESC',
    [contactId]
  )
  return result.rows.map(toEstimate)
}

export async function listAllEstimates(): Promise<EstimateWithContactName[]> {
  const result = await getDb().query<EstimateRow & { contactName: string; subtotalCents: string }>(
    `SELECT e.*, c.name as "contactName",
       COALESCE((SELECT SUM(ROUND(i.quantity * i."unitPriceCents"))
                 FROM estimate_items i WHERE i."estimateId" = e.id), 0) AS "subtotalCents"
     FROM estimates e JOIN contacts c ON c.id = e."contactId"
     ORDER BY e."createdAt" DESC`
  )
  return result.rows.map((row) => {
    const subtotalCents = Number(row.subtotalCents)
    return {
      ...toEstimate(row),
      contactName: row.contactName,
      totalCents: Math.round(subtotalCents * (1 + row.taxPercent / 100))
    }
  })
}

export async function updateEstimateDraft(
  id: string,
  input: UpdateEstimateInput
): Promise<EstimateWithItems | null> {
  const existing = await getEstimate(id)
  if (!existing || existing.status !== 'draft') return existing

  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE estimates SET title = $1, "taxPercent" = $2, "updatedAt" = now() WHERE id = $3`,
      [input.title, input.taxPercent, id]
    )
    await replaceItems(client, id, input.items)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return getEstimate(id)
}

export async function sendEstimate(id: string): Promise<Estimate | null> {
  const token = randomBytes(24).toString('hex')
  const result = await getDb().query<EstimateRow>(
    `UPDATE estimates SET status = 'sent', "signToken" = COALESCE("signToken", $1), "sentAt" = now(), "updatedAt" = now()
     WHERE id = $2
     RETURNING *`,
    [token, id]
  )
  return result.rows[0] ? toEstimate(result.rows[0]) : null
}

export async function linkEstimateInvoice(id: string, invoiceId: string): Promise<void> {
  await getDb().query(
    `UPDATE estimates SET status = 'invoiced', "invoiceId" = $1, "updatedAt" = now() WHERE id = $2`,
    [invoiceId, id]
  )
}

export async function deleteEstimate(id: string): Promise<void> {
  await getDb().query('DELETE FROM estimates WHERE id = $1', [id])
}
