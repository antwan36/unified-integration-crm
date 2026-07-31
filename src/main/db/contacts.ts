import { getDb } from './index'
import { newId } from './ids'
import type {
  Contact,
  ContactStatus,
  ListContactsFilter,
  CreateContactInput,
  UpdateContactInput
} from '../../shared/types'

interface ContactRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string
  status: string
  address: string | null
  notes: string | null
  unmatched: boolean
  jobType: string | null
  createdAt: Date
  updatedAt: Date
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    status: row.status as ContactStatus,
    address: row.address,
    notes: row.notes,
    unmatched: row.unmatched,
    jobType: row.jobType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export async function listContacts(filter: ListContactsFilter = {}): Promise<Contact[]> {
  let query = 'SELECT * FROM contacts WHERE 1=1'
  const params: string[] = []

  if (filter.status) {
    params.push(filter.status)
    query += ` AND status = $${params.length}`
  }
  if (filter.jobType) {
    params.push(filter.jobType)
    query += ` AND "jobType" = $${params.length}`
  }
  if (filter.source) {
    params.push(filter.source)
    query += ` AND source = $${params.length}`
  }
  if (filter.search) {
    const like = `%${filter.search}%`
    params.push(like, like, like)
    query += ` AND (name ILIKE $${params.length - 2} OR email ILIKE $${params.length - 1} OR phone ILIKE $${params.length})`
  }
  query += ' ORDER BY "updatedAt" DESC'

  const result = await getDb().query<ContactRow>(query, params)
  return result.rows.map(toContact)
}

export async function getContact(id: string): Promise<Contact | null> {
  const result = await getDb().query<ContactRow>('SELECT * FROM contacts WHERE id = $1', [id])
  return result.rows[0] ? toContact(result.rows[0]) : null
}

export async function findContactByEmail(email: string): Promise<Contact | null> {
  const result = await getDb().query<ContactRow>(
    'SELECT * FROM contacts WHERE email ILIKE $1 LIMIT 1',
    [email.trim()]
  )
  return result.rows[0] ? toContact(result.rows[0]) : null
}

export async function findOrCreateContactByEmail(
  email: string,
  name?: string | null
): Promise<Contact> {
  const existing = await findContactByEmail(email)
  if (existing) return existing
  return createContact({
    name: name?.trim() || email.trim(),
    email: email.trim(),
    source: 'email',
    status: 'New',
    unmatched: true
  })
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const id = newId()
  await getDb().query(
    `INSERT INTO contacts (id, name, email, phone, source, status, address, notes, unmatched, "jobType")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.source ?? 'manual',
      input.status ?? 'New',
      input.address ?? null,
      input.notes ?? null,
      !!input.unmatched,
      input.jobType ?? null
    ]
  )
  return (await getContact(id))!
}

export async function updateContact(
  id: string,
  input: UpdateContactInput
): Promise<Contact | null> {
  const existing = await getContact(id)
  if (!existing) return null

  await getDb().query(
    `UPDATE contacts SET
      name = $1, email = $2, phone = $3, status = $4, address = $5, notes = $6, unmatched = $7,
      "jobType" = $8, "updatedAt" = now()
     WHERE id = $9`,
    [
      input.name ?? existing.name,
      input.email !== undefined ? input.email : existing.email,
      input.phone !== undefined ? input.phone : existing.phone,
      input.status ?? existing.status,
      input.address !== undefined ? input.address : existing.address,
      input.notes !== undefined ? input.notes : existing.notes,
      input.unmatched !== undefined ? input.unmatched : existing.unmatched,
      input.jobType !== undefined ? input.jobType : existing.jobType,
      id
    ]
  )
  return getContact(id)
}

export async function deleteContact(id: string): Promise<void> {
  await getDb().query('DELETE FROM contacts WHERE id = $1', [id])
}

export async function countByStatus(): Promise<Record<string, number>> {
  const result = await getDb().query<{ status: string; count: string }>(
    'SELECT status, COUNT(*) as count FROM contacts GROUP BY status'
  )
  const out: Record<string, number> = {}
  for (const row of result.rows) out[row.status] = Number(row.count)
  return out
}

export async function countAll(): Promise<number> {
  const result = await getDb().query<{ count: string }>('SELECT COUNT(*) as count FROM contacts')
  return Number(result.rows[0].count)
}

export async function countUnmatched(): Promise<number> {
  const result = await getDb().query<{ count: string }>(
    'SELECT COUNT(*) as count FROM contacts WHERE unmatched = true'
  )
  return Number(result.rows[0].count)
}

export async function recentContacts(limit = 5): Promise<Contact[]> {
  const result = await getDb().query<ContactRow>(
    'SELECT * FROM contacts ORDER BY "createdAt" DESC LIMIT $1',
    [limit]
  )
  return result.rows.map(toContact)
}

/** Open leads (not Won/Lost) that haven't been touched in `days` days — a "going cold" list. */
export async function listStaleLeads(days: number, limit = 10): Promise<Contact[]> {
  const result = await getDb().query<ContactRow>(
    `SELECT * FROM contacts
     WHERE status NOT IN ('Won', 'Lost')
       AND "updatedAt" < now() - ($1 || ' days')::interval
     ORDER BY "updatedAt" ASC
     LIMIT $2`,
    [days, limit]
  )
  return result.rows.map(toContact)
}

export async function findContactBySquareCustomerId(squareCustomerId: string): Promise<Contact | null> {
  const result = await getDb().query<ContactRow>(
    'SELECT * FROM contacts WHERE "squareCustomerId" = $1 LIMIT 1',
    [squareCustomerId]
  )
  return result.rows[0] ? toContact(result.rows[0]) : null
}

export async function getSquareCustomerId(contactId: string): Promise<string | null> {
  const result = await getDb().query<{ squareCustomerId: string | null }>(
    'SELECT "squareCustomerId" FROM contacts WHERE id = $1',
    [contactId]
  )
  return result.rows[0]?.squareCustomerId ?? null
}

export async function setSquareCustomerId(
  contactId: string,
  squareCustomerId: string
): Promise<void> {
  await getDb().query('UPDATE contacts SET "squareCustomerId" = $1 WHERE id = $2', [
    squareCustomerId,
    contactId
  ])
}

export async function getQuickBooksCustomerId(contactId: string): Promise<string | null> {
  const result = await getDb().query<{ quickbooksCustomerId: string | null }>(
    'SELECT "quickbooksCustomerId" FROM contacts WHERE id = $1',
    [contactId]
  )
  return result.rows[0]?.quickbooksCustomerId ?? null
}

export async function setQuickBooksCustomerId(
  contactId: string,
  quickbooksCustomerId: string
): Promise<void> {
  await getDb().query('UPDATE contacts SET "quickbooksCustomerId" = $1 WHERE id = $2', [
    quickbooksCustomerId,
    contactId
  ])
}
