import { getDb } from './index'
import { newId } from './ids'
import type {
  Activity,
  ActivityDirection,
  ActivityType,
  EmailActivity,
  ListEmailsFilter
} from '../../shared/types'

interface ActivityRow {
  id: string
  contactId: string
  type: string
  subject: string | null
  body: string | null
  direction: string | null
  occurredAt: Date
  meta: string | null
  messageId: string | null
  read: boolean
  emailAccountId: string | null
  createdAt: Date
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    contactId: row.contactId,
    type: row.type as ActivityType,
    subject: row.subject,
    body: row.body,
    direction: row.direction as ActivityDirection,
    occurredAt: row.occurredAt.toISOString(),
    meta: row.meta,
    messageId: row.messageId,
    read: row.read,
    emailAccountId: row.emailAccountId,
    createdAt: row.createdAt.toISOString()
  }
}

export async function listActivitiesForContact(contactId: string): Promise<Activity[]> {
  const result = await getDb().query<ActivityRow>(
    'SELECT * FROM activities WHERE "contactId" = $1 ORDER BY "occurredAt" DESC',
    [contactId]
  )
  return result.rows.map(toActivity)
}

export interface CreateActivityInput {
  contactId: string
  type: ActivityType
  subject?: string | null
  body?: string | null
  direction?: ActivityDirection
  occurredAt?: string
  meta?: string | null
  messageId?: string | null
  read?: boolean
  emailAccountId?: string | null
}

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const id = newId()
  const result = await getDb().query<ActivityRow>(
    `INSERT INTO activities (id, "contactId", type, subject, body, direction, "occurredAt", meta, "messageId", read, "emailAccountId")
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8, $9, $10, $11)
     ON CONFLICT ("messageId") DO NOTHING
     RETURNING *`,
    [
      id,
      input.contactId,
      input.type,
      input.subject ?? null,
      input.body ?? null,
      input.direction ?? null,
      input.occurredAt ?? null,
      input.meta ?? null,
      input.messageId ?? null,
      input.read ?? true,
      input.emailAccountId ?? null
    ]
  )
  if (result.rows[0]) return toActivity(result.rows[0])

  // Another machine's sync already inserted this message between our check and insert.
  const existing = await getDb().query<ActivityRow>(
    'SELECT * FROM activities WHERE "messageId" = $1',
    [input.messageId]
  )
  return toActivity(existing.rows[0])
}

// Scoped to type = 'note' — this is only ever exposed for manually-added notes,
// not synced records like emails or form submissions, which should stay as a
// permanent record even if you want them out of view.
export async function deleteNote(id: string): Promise<void> {
  await getDb().query(`DELETE FROM activities WHERE id = $1 AND type = 'note'`, [id])
}

export async function messageIdExists(messageId: string): Promise<boolean> {
  const result = await getDb().query('SELECT 1 FROM activities WHERE "messageId" = $1', [
    messageId
  ])
  return result.rows.length > 0
}

export async function listEmailActivities(filter: ListEmailsFilter = {}): Promise<{
  items: EmailActivity[]
  total: number
}> {
  const whereParams: string[] = []
  let where = `a.type = 'email'`

  if (filter.unreadOnly) {
    where += ' AND a.read = FALSE'
  }
  if (filter.search) {
    const like = `%${filter.search.trim()}%`
    whereParams.push(like, like, like, like)
    where += ` AND (a.subject ILIKE $${whereParams.length - 3} OR a.body ILIKE $${whereParams.length - 2} OR c.name ILIKE $${whereParams.length - 1} OR c.email ILIKE $${whereParams.length})`
  }

  const limit = filter.limit ?? 50
  const offset = filter.offset ?? 0
  const listParams = [...whereParams, limit, offset]

  const result = await getDb().query<
    ActivityRow & { contactName: string; contactEmail: string | null; emailAccountLabel: string | null }
  >(
    `SELECT a.*, c.name as "contactName", c.email as "contactEmail", ea.label as "emailAccountLabel"
     FROM activities a
     JOIN contacts c ON c.id = a."contactId"
     LEFT JOIN email_accounts ea ON ea.id = a."emailAccountId"
     WHERE ${where}
     ORDER BY a."occurredAt" DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  )
  const countResult = await getDb().query<{ count: string }>(
    `SELECT COUNT(*) FROM activities a JOIN contacts c ON c.id = a."contactId" WHERE ${where}`,
    whereParams
  )

  return {
    items: result.rows.map((row) => ({
      ...toActivity(row),
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      emailAccountLabel: row.emailAccountLabel
    })),
    total: parseInt(countResult.rows[0].count, 10)
  }
}

export async function countUnreadEmails(): Promise<number> {
  const result = await getDb().query<{ count: string }>(
    `SELECT COUNT(*) FROM activities WHERE type = 'email' AND read = FALSE`
  )
  return parseInt(result.rows[0].count, 10)
}

export async function markActivityRead(id: string): Promise<void> {
  await getDb().query('UPDATE activities SET read = TRUE WHERE id = $1', [id])
}

export async function recentActivitiesWithContactName(
  limit = 10
): Promise<(Activity & { contactName: string })[]> {
  const result = await getDb().query<ActivityRow & { contactName: string }>(
    `SELECT a.*, c.name as "contactName"
     FROM activities a JOIN contacts c ON c.id = a."contactId"
     ORDER BY a."occurredAt" DESC LIMIT $1`,
    [limit]
  )
  return result.rows.map((row) => ({ ...toActivity(row), contactName: row.contactName }))
}
