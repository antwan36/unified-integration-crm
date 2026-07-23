import { getDb } from './index'
import { newId } from './ids'
import type { CatalogItem, CreateCatalogItemInput, UpdateCatalogItemInput } from '../../shared/types'

interface CatalogItemRow {
  id: string
  name: string
  description: string | null
  unitPriceCents: number
  createdAt: Date
  updatedAt: Date
}

function toCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unitPriceCents: row.unitPriceCents,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export async function listCatalogItems(): Promise<CatalogItem[]> {
  const result = await getDb().query<CatalogItemRow>('SELECT * FROM catalog_items ORDER BY name ASC')
  return result.rows.map(toCatalogItem)
}

export async function createCatalogItem(input: CreateCatalogItemInput): Promise<CatalogItem> {
  const id = newId()
  await getDb().query(
    `INSERT INTO catalog_items (id, name, description, "unitPriceCents")
     VALUES ($1, $2, $3, $4)`,
    [id, input.name, input.description ?? null, input.unitPriceCents]
  )
  const result = await getDb().query<CatalogItemRow>('SELECT * FROM catalog_items WHERE id = $1', [id])
  return toCatalogItem(result.rows[0])
}

export async function updateCatalogItem(
  id: string,
  input: UpdateCatalogItemInput
): Promise<CatalogItem | null> {
  const result = await getDb().query<CatalogItemRow>(
    `UPDATE catalog_items SET name = $1, description = $2, "unitPriceCents" = $3, "updatedAt" = now()
     WHERE id = $4
     RETURNING *`,
    [input.name, input.description ?? null, input.unitPriceCents, id]
  )
  return result.rows[0] ? toCatalogItem(result.rows[0]) : null
}

export async function deleteCatalogItem(id: string): Promise<void> {
  await getDb().query('DELETE FROM catalog_items WHERE id = $1', [id])
}
