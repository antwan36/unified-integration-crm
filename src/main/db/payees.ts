import { getDb } from './index'
import { newId } from './ids'
import { encrypt, decrypt } from '../secrets/encryption'
import { loadWorkspaceConfig } from '../secrets/workspace'
import type { CreatePayeeInput, Payee, UpdatePayeeInput } from '../../shared/types'

interface PayeeRow {
  id: string
  name: string
  type: Payee['type']
  email: string | null
  phone: string | null
  encryptedTaxId: string | null
  rateType: Payee['rateType']
  defaultRateCents: number | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

function encryptionKey(): Buffer {
  const config = loadWorkspaceConfig()
  if (!config) throw new Error('Not connected to a workspace yet')
  return config.encryptionKey
}

function toPayee(row: PayeeRow): Payee {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    email: row.email,
    phone: row.phone,
    hasTaxId: !!row.encryptedTaxId,
    rateType: row.rateType,
    defaultRateCents: row.defaultRateCents,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export async function listPayees(): Promise<Payee[]> {
  const result = await getDb().query<PayeeRow>('SELECT * FROM payees ORDER BY name ASC')
  return result.rows.map(toPayee)
}

export async function getPayee(id: string): Promise<Payee | null> {
  const result = await getDb().query<PayeeRow>('SELECT * FROM payees WHERE id = $1', [id])
  return result.rows[0] ? toPayee(result.rows[0]) : null
}

export async function createPayee(input: CreatePayeeInput): Promise<Payee> {
  const id = newId()
  await getDb().query(
    `INSERT INTO payees
       (id, name, type, email, phone, "encryptedTaxId", "rateType", "defaultRateCents")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.name,
      input.type,
      input.email ?? null,
      input.phone ?? null,
      input.taxId ? encrypt(input.taxId, encryptionKey()) : null,
      input.rateType,
      input.defaultRateCents ?? null
    ]
  )
  return (await getPayee(id))!
}

export async function updatePayee(id: string, input: UpdatePayeeInput): Promise<Payee | null> {
  const existing = await getPayee(id)
  if (!existing) return null

  await getDb().query(
    `UPDATE payees SET
       name = $1, type = $2, email = $3, phone = $4,
       "encryptedTaxId" = COALESCE($5, "encryptedTaxId"),
       "rateType" = $6, "defaultRateCents" = $7, active = $8, "updatedAt" = now()
     WHERE id = $9`,
    [
      input.name,
      input.type,
      input.email ?? null,
      input.phone ?? null,
      input.taxId ? encrypt(input.taxId, encryptionKey()) : null,
      input.rateType,
      input.defaultRateCents ?? null,
      input.active,
      id
    ]
  )
  return getPayee(id)
}

export async function deletePayee(id: string): Promise<void> {
  await getDb().query('DELETE FROM payees WHERE id = $1', [id])
}

/** Only used by the 1099 export flow — never surfaced to a plain list view. */
export async function decryptPayeeTaxId(id: string): Promise<string | null> {
  const result = await getDb().query<{ encryptedTaxId: string | null }>(
    'SELECT "encryptedTaxId" FROM payees WHERE id = $1',
    [id]
  )
  const encrypted = result.rows[0]?.encryptedTaxId
  return encrypted ? decrypt(encrypted, encryptionKey()) : null
}
