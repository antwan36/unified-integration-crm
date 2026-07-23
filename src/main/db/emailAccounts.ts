import { getDb } from './index'
import { newId } from './ids'
import { encrypt, decrypt } from '../secrets/encryption'
import { loadWorkspaceConfig } from '../secrets/workspace'
import { loadImapCredentials } from '../secrets/credentials'
import type { CreateEmailAccountInput, EmailAccount, UpdateEmailAccountInput } from '../../shared/types'

/** The fixed sync_state key the single-account era always used (see legacy Settings.tsx form). */
const LEGACY_SYNC_MAILBOX_KEY = 'inbox'

interface EmailAccountRow {
  id: string
  label: string
  host: string
  port: number
  secure: boolean
  user: string
  encryptedPassword: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  createdAt: Date
  updatedAt: Date
}

export interface EmailAccountCredentials extends EmailAccount {
  password: string
}

function encryptionKey(): Buffer {
  const config = loadWorkspaceConfig()
  if (!config) throw new Error('Not connected to a workspace yet')
  return config.encryptionKey
}

function toEmailAccount(row: EmailAccountRow): EmailAccount {
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    port: row.port,
    secure: row.secure,
    user: row.user,
    hasPassword: !!row.encryptedPassword,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    createdAt: row.createdAt.toISOString()
  }
}

export async function listEmailAccounts(): Promise<EmailAccount[]> {
  const result = await getDb().query<EmailAccountRow>(
    'SELECT * FROM email_accounts ORDER BY "createdAt" ASC'
  )
  return result.rows.map(toEmailAccount)
}

export async function getEmailAccount(id: string): Promise<EmailAccount | null> {
  const result = await getDb().query<EmailAccountRow>(
    'SELECT * FROM email_accounts WHERE id = $1',
    [id]
  )
  return result.rows[0] ? toEmailAccount(result.rows[0]) : null
}

export async function loadEmailAccountCredentials(
  id: string
): Promise<EmailAccountCredentials | null> {
  const result = await getDb().query<EmailAccountRow>(
    'SELECT * FROM email_accounts WHERE id = $1',
    [id]
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    ...toEmailAccount(row),
    password: decrypt(row.encryptedPassword, encryptionKey())
  }
}

export async function createEmailAccount(input: CreateEmailAccountInput): Promise<EmailAccount> {
  const id = newId()
  await getDb().query(
    `INSERT INTO email_accounts
       (id, label, host, port, secure, "user", "encryptedPassword", "smtpHost", "smtpPort", "smtpSecure")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.label,
      input.host,
      input.port,
      input.secure,
      input.user,
      encrypt(input.password, encryptionKey()),
      input.smtpHost,
      input.smtpPort,
      input.smtpSecure
    ]
  )
  return (await getEmailAccount(id))!
}

export async function updateEmailAccount(
  id: string,
  input: UpdateEmailAccountInput
): Promise<EmailAccount | null> {
  const existing = await getEmailAccount(id)
  if (!existing) return null

  await getDb().query(
    `UPDATE email_accounts SET
       label = $1, host = $2, port = $3, secure = $4, "user" = $5,
       "smtpHost" = $6, "smtpPort" = $7, "smtpSecure" = $8,
       "encryptedPassword" = COALESCE($9, "encryptedPassword"),
       "updatedAt" = now()
     WHERE id = $10`,
    [
      input.label ?? existing.label,
      input.host ?? existing.host,
      input.port ?? existing.port,
      input.secure ?? existing.secure,
      input.user ?? existing.user,
      input.smtpHost ?? existing.smtpHost,
      input.smtpPort ?? existing.smtpPort,
      input.smtpSecure ?? existing.smtpSecure,
      input.password ? encrypt(input.password, encryptionKey()) : null,
      id
    ]
  )
  return getEmailAccount(id)
}

export async function deleteEmailAccount(id: string): Promise<void> {
  await getDb().query('UPDATE activities SET "emailAccountId" = NULL WHERE "emailAccountId" = $1', [
    id
  ])
  await getDb().query('DELETE FROM email_accounts WHERE id = $1', [id])
}

/**
 * One-time upgrade path: the app used to support exactly one IMAP/SMTP account, stored under a
 * single encrypted settings key. Copy it into email_accounts the first time this machine sees the
 * new multi-account schema so nobody loses their already-configured mailbox.
 */
export async function migrateLegacyImapAccountIfNeeded(): Promise<void> {
  const existing = await listEmailAccounts()
  if (existing.length > 0) return

  const legacy = await loadImapCredentials()
  if (!legacy) return

  const account = await createEmailAccount({
    label: legacy.user,
    host: legacy.host,
    port: legacy.port,
    secure: legacy.secure,
    user: legacy.user,
    password: legacy.password,
    smtpHost: legacy.smtpHost,
    smtpPort: legacy.smtpPort,
    smtpSecure: legacy.smtpSecure
  })

  // Carry the existing IMAP progress marker forward under the new account id so the next sync
  // resumes where it left off instead of rescanning the whole mailbox from UID 1.
  await getDb().query('UPDATE sync_state SET mailbox = $1 WHERE mailbox = $2', [
    account.id,
    LEGACY_SYNC_MAILBOX_KEY
  ])
}
