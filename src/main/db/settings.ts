import { getDb } from './index'

export async function getSetting(key: string): Promise<string | null> {
  const result = await getDb().query<{ encryptedValue: string }>(
    'SELECT "encryptedValue" FROM settings WHERE key = $1',
    [key]
  )
  return result.rows[0]?.encryptedValue ?? null
}

export async function setSetting(key: string, encryptedValue: string): Promise<void> {
  await getDb().query(
    `INSERT INTO settings (key, "encryptedValue") VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET "encryptedValue" = EXCLUDED."encryptedValue", "updatedAt" = now()`,
    [key, encryptedValue]
  )
}
