import { getDb } from './index'
import { newId } from './ids'
import type {
  CreateInventoryItemInput,
  CreateInventoryTransactionInput,
  InventoryItem,
  InventoryTransaction,
  UpdateInventoryItemInput
} from '../../shared/types'

interface InventoryItemRow {
  id: string
  name: string
  sku: string | null
  description: string | null
  category: string | null
  unitCostCents: number
  quantityOnHand: number
  reorderThreshold: number | null
  location: string | null
  createdAt: Date
  updatedAt: Date
}

interface InventoryTransactionRow {
  id: string
  itemId: string
  type: InventoryTransaction['type']
  quantityDelta: number
  unitCostCents: number | null
  contactId: string | null
  notes: string | null
  date: string
  createdAt: Date
}

function toInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    category: row.category,
    unitCostCents: row.unitCostCents,
    quantityOnHand: row.quantityOnHand,
    reorderThreshold: row.reorderThreshold,
    location: row.location,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function toInventoryTransaction(row: InventoryTransactionRow): InventoryTransaction {
  return {
    id: row.id,
    itemId: row.itemId,
    type: row.type,
    quantityDelta: row.quantityDelta,
    unitCostCents: row.unitCostCents,
    contactId: row.contactId,
    notes: row.notes,
    date: row.date,
    createdAt: row.createdAt.toISOString()
  }
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  const result = await getDb().query<InventoryItemRow>(
    'SELECT * FROM inventory_items ORDER BY name ASC'
  )
  return result.rows.map(toInventoryItem)
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<InventoryItem> {
  const id = newId()
  await getDb().query(
    `INSERT INTO inventory_items
       (id, name, sku, description, category, "unitCostCents", "quantityOnHand", "reorderThreshold", location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.name,
      input.sku ?? null,
      input.description ?? null,
      input.category ?? null,
      input.unitCostCents,
      input.quantityOnHand ?? 0,
      input.reorderThreshold ?? null,
      input.location ?? null
    ]
  )
  const result = await getDb().query<InventoryItemRow>('SELECT * FROM inventory_items WHERE id = $1', [
    id
  ])
  return toInventoryItem(result.rows[0])
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput
): Promise<InventoryItem | null> {
  const result = await getDb().query<InventoryItemRow>(
    `UPDATE inventory_items SET
       name = $1, sku = $2, description = $3, category = $4, "unitCostCents" = $5,
       "reorderThreshold" = $6, location = $7, "updatedAt" = now()
     WHERE id = $8
     RETURNING *`,
    [
      input.name,
      input.sku ?? null,
      input.description ?? null,
      input.category ?? null,
      input.unitCostCents,
      input.reorderThreshold ?? null,
      input.location ?? null,
      id
    ]
  )
  return result.rows[0] ? toInventoryItem(result.rows[0]) : null
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await getDb().query('DELETE FROM inventory_items WHERE id = $1', [id])
}

export async function listInventoryTransactionsForItem(
  itemId: string
): Promise<InventoryTransaction[]> {
  const result = await getDb().query<InventoryTransactionRow>(
    'SELECT * FROM inventory_transactions WHERE "itemId" = $1 ORDER BY date DESC, "createdAt" DESC',
    [itemId]
  )
  return result.rows.map(toInventoryTransaction)
}

export async function recordInventoryTransaction(
  input: CreateInventoryTransactionInput
): Promise<InventoryTransaction> {
  const id = newId()
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO inventory_transactions
         (id, "itemId", type, "quantityDelta", "unitCostCents", "contactId", notes, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        input.itemId,
        input.type,
        input.quantityDelta,
        input.unitCostCents ?? null,
        input.contactId ?? null,
        input.notes ?? null,
        input.date
      ]
    )
    await client.query(
      `UPDATE inventory_items SET "quantityOnHand" = "quantityOnHand" + $1, "updatedAt" = now() WHERE id = $2`,
      [input.quantityDelta, input.itemId]
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  const result = await getDb().query<InventoryTransactionRow>(
    'SELECT * FROM inventory_transactions WHERE id = $1',
    [id]
  )
  return toInventoryTransaction(result.rows[0])
}
