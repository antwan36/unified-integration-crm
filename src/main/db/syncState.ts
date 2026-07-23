import { getDb } from './index'
import { newId } from './ids'

export interface SyncStateRow {
  id: string
  mailbox: string
  lastSeenUid: number
  lastSyncedAt: string | null
}

interface RawSyncStateRow {
  id: string
  mailbox: string
  lastSeenUid: number
  lastSyncedAt: Date | null
}

function toSyncState(row: RawSyncStateRow): SyncStateRow {
  return { ...row, lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null }
}

export async function getSyncState(mailbox: string): Promise<SyncStateRow> {
  const result = await getDb().query<RawSyncStateRow>(
    'SELECT * FROM sync_state WHERE mailbox = $1',
    [mailbox]
  )
  if (result.rows[0]) return toSyncState(result.rows[0])

  const id = newId()
  await getDb().query(
    `INSERT INTO sync_state (id, mailbox, "lastSeenUid") VALUES ($1, $2, 0)
     ON CONFLICT (mailbox) DO NOTHING`,
    [id, mailbox]
  )
  return getSyncState(mailbox)
}

export async function updateSyncState(mailbox: string, lastSeenUid: number): Promise<void> {
  await getSyncState(mailbox)
  await getDb().query(
    `UPDATE sync_state SET "lastSeenUid" = $1, "lastSyncedAt" = now() WHERE mailbox = $2`,
    [lastSeenUid, mailbox]
  )
}
