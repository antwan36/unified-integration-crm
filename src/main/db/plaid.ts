import { getDb } from './index'
import { newId } from './ids'
import { encrypt, decrypt } from '../secrets/encryption'
import { loadWorkspaceConfig } from '../secrets/workspace'
import type {
  BankAccount,
  BankTransaction,
  BankTransactionWithAccount,
  ExpenseCategory,
  FinancesSummaryPoint,
  PlaidItemStatus,
  PlaidItemSummary,
  UpdateBankTransactionInput
} from '../../shared/types'

function encryptionKey(): Buffer {
  const config = loadWorkspaceConfig()
  if (!config) throw new Error('Not connected to a workspace yet')
  return config.encryptionKey
}

interface PlaidItemRow {
  id: string
  itemId: string
  institutionName: string
  encryptedAccessToken: string
  transactionsCursor: string | null
  status: PlaidItemStatus
  createdAt: Date
  updatedAt: Date
}

export async function createPlaidItem(
  plaidItemId: string,
  institutionName: string,
  accessToken: string
): Promise<string> {
  const id = newId()
  await getDb().query(
    `INSERT INTO plaid_items (id, "itemId", "institutionName", "encryptedAccessToken")
     VALUES ($1, $2, $3, $4)`,
    [id, plaidItemId, institutionName, encrypt(accessToken, encryptionKey())]
  )
  return id
}

export async function listPlaidItemsForSync(): Promise<
  { id: string; institutionName: string; accessToken: string; cursor: string | null }[]
> {
  const result = await getDb().query<PlaidItemRow>('SELECT * FROM plaid_items WHERE status != $1', [
    'error'
  ])
  return result.rows.map((row) => ({
    id: row.id,
    institutionName: row.institutionName,
    accessToken: decrypt(row.encryptedAccessToken, encryptionKey()),
    cursor: row.transactionsCursor
  }))
}

export async function listPlaidItemSummaries(): Promise<PlaidItemSummary[]> {
  const result = await getDb().query<PlaidItemRow>(
    'SELECT * FROM plaid_items ORDER BY "createdAt" ASC'
  )
  return result.rows.map((row) => ({
    id: row.id,
    institutionName: row.institutionName,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  }))
}

export async function countPlaidItems(): Promise<number> {
  const result = await getDb().query<{ count: string }>('SELECT COUNT(*) AS count FROM plaid_items')
  return Number(result.rows[0].count)
}

export async function updatePlaidItemCursor(id: string, cursor: string): Promise<void> {
  await getDb().query(
    `UPDATE plaid_items SET "transactionsCursor" = $1, "updatedAt" = now() WHERE id = $2`,
    [cursor, id]
  )
}

export async function setPlaidItemStatus(id: string, status: PlaidItemStatus): Promise<void> {
  await getDb().query(`UPDATE plaid_items SET status = $1, "updatedAt" = now() WHERE id = $2`, [
    status,
    id
  ])
}

interface UpsertBankAccountInput {
  plaidItemId: string
  plaidAccountId: string
  name: string
  mask: string | null
  type: string | null
  subtype: string | null
  currentBalanceCents: number | null
  availableBalanceCents: number | null
}

export async function upsertBankAccount(input: UpsertBankAccountInput): Promise<string> {
  const result = await getDb().query<{ id: string }>(
    `INSERT INTO bank_accounts
       (id, "plaidItemId", "plaidAccountId", name, mask, type, subtype, "currentBalanceCents", "availableBalanceCents")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT ("plaidAccountId") DO UPDATE SET
       name = EXCLUDED.name,
       "currentBalanceCents" = EXCLUDED."currentBalanceCents",
       "availableBalanceCents" = EXCLUDED."availableBalanceCents",
       "updatedAt" = now()
     RETURNING id`,
    [
      newId(),
      input.plaidItemId,
      input.plaidAccountId,
      input.name,
      input.mask,
      input.type,
      input.subtype,
      input.currentBalanceCents,
      input.availableBalanceCents
    ]
  )
  return result.rows[0].id
}

interface BankAccountRow {
  id: string
  plaidItemId: string
  name: string
  mask: string | null
  type: string | null
  subtype: string | null
  currentBalanceCents: number | null
  availableBalanceCents: number | null
  createdAt: Date
  updatedAt: Date
  institutionName: string
}

export async function getBankAccountIdByPlaidAccountId(plaidAccountId: string): Promise<string | null> {
  const result = await getDb().query<{ id: string }>(
    'SELECT id FROM bank_accounts WHERE "plaidAccountId" = $1',
    [plaidAccountId]
  )
  return result.rows[0]?.id ?? null
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const result = await getDb().query<BankAccountRow>(
    `SELECT a.*, i."institutionName" AS "institutionName"
     FROM bank_accounts a
     JOIN plaid_items i ON i.id = a."plaidItemId"
     ORDER BY i."institutionName" ASC, a.name ASC`
  )
  return result.rows.map((row) => ({
    id: row.id,
    plaidItemId: row.plaidItemId,
    institutionName: row.institutionName,
    name: row.name,
    mask: row.mask,
    type: row.type,
    subtype: row.subtype,
    currentBalanceCents: row.currentBalanceCents,
    availableBalanceCents: row.availableBalanceCents,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }))
}

interface UpsertBankTransactionInput {
  bankAccountId: string
  plaidTransactionId: string
  amountCents: number
  date: string
  merchantName: string | null
  plaidCategory: string | null
  pending: boolean
}

export async function upsertBankTransaction(input: UpsertBankTransactionInput): Promise<void> {
  await getDb().query(
    `INSERT INTO bank_transactions
       (id, "bankAccountId", "plaidTransactionId", "amountCents", date, "merchantName", "plaidCategory", pending)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT ("plaidTransactionId") DO UPDATE SET
       "amountCents" = EXCLUDED."amountCents",
       date = EXCLUDED.date,
       "merchantName" = EXCLUDED."merchantName",
       "plaidCategory" = EXCLUDED."plaidCategory",
       pending = EXCLUDED.pending`,
    [
      newId(),
      input.bankAccountId,
      input.plaidTransactionId,
      input.amountCents,
      input.date,
      input.merchantName,
      input.plaidCategory,
      input.pending
    ]
  )
}

export async function removeBankTransactionByPlaidId(plaidTransactionId: string): Promise<void> {
  await getDb().query('DELETE FROM bank_transactions WHERE "plaidTransactionId" = $1', [
    plaidTransactionId
  ])
}

interface BankTransactionRow {
  id: string
  bankAccountId: string
  amountCents: number
  date: string
  merchantName: string | null
  plaidCategory: string | null
  userCategory: ExpenseCategory | null
  contactId: string | null
  pending: boolean
  notes: string | null
  createdAt: Date
  accountName: string
  institutionName: string
}

function toBankTransaction(row: BankTransactionRow): BankTransactionWithAccount {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    amountCents: row.amountCents,
    date: row.date,
    merchantName: row.merchantName,
    plaidCategory: row.plaidCategory,
    userCategory: row.userCategory,
    contactId: row.contactId,
    pending: row.pending,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    accountName: row.accountName,
    institutionName: row.institutionName
  }
}

export async function listBankTransactions(): Promise<BankTransactionWithAccount[]> {
  const result = await getDb().query<BankTransactionRow>(
    `SELECT t.*, a.name AS "accountName", i."institutionName" AS "institutionName"
     FROM bank_transactions t
     JOIN bank_accounts a ON a.id = t."bankAccountId"
     JOIN plaid_items i ON i.id = a."plaidItemId"
     ORDER BY t.date DESC, t."createdAt" DESC
     LIMIT 500`
  )
  return result.rows.map(toBankTransaction)
}

interface PlainBankTransactionRow {
  id: string
  bankAccountId: string
  amountCents: number
  date: string
  merchantName: string | null
  plaidCategory: string | null
  userCategory: ExpenseCategory | null
  contactId: string | null
  pending: boolean
  notes: string | null
  createdAt: Date
}

export async function updateBankTransaction(
  id: string,
  input: UpdateBankTransactionInput
): Promise<BankTransaction | null> {
  const result = await getDb().query<PlainBankTransactionRow>(
    `UPDATE bank_transactions SET
       "userCategory" = COALESCE($1, "userCategory"),
       "contactId" = $2,
       notes = $3
     WHERE id = $4
     RETURNING *`,
    [input.userCategory ?? null, input.contactId ?? null, input.notes ?? null, id]
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    amountCents: row.amountCents,
    date: row.date,
    merchantName: row.merchantName,
    plaidCategory: row.plaidCategory,
    userCategory: row.userCategory,
    contactId: row.contactId,
    pending: row.pending,
    notes: row.notes,
    createdAt: row.createdAt.toISOString()
  }
}

export async function getFinancesSummary(): Promise<FinancesSummaryPoint[]> {
  const result = await getDb().query<{ month: string; incomeCents: string; expenseCents: string }>(
    `SELECT
       to_char(date::date, 'YYYY-MM') AS month,
       SUM(CASE WHEN "amountCents" < 0 THEN -"amountCents" ELSE 0 END) AS "incomeCents",
       SUM(CASE WHEN "amountCents" > 0 THEN "amountCents" ELSE 0 END) AS "expenseCents"
     FROM bank_transactions
     GROUP BY month
     ORDER BY month ASC`
  )
  return result.rows.map((row) => ({
    month: row.month,
    incomeCents: Number(row.incomeCents),
    expenseCents: Number(row.expenseCents)
  }))
}
