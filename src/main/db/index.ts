import { Pool } from 'pg'
import { SCHEMA_SQL } from './schema'

let pool: Pool | null = null

export function initDb(connectionString: string): Pool {
  pool = new Pool({ connectionString, ssl: { rejectUnauthorized: true } })
  return pool
}

export function getDb(): Pool {
  if (!pool) throw new Error('Not connected to a workspace database yet')
  return pool
}

export function isDbConnected(): boolean {
  return pool !== null
}

export async function ensureSchema(): Promise<void> {
  await getDb().query(SCHEMA_SQL)
}

export async function testConnectionString(
  connectionString: string
): Promise<{ ok: boolean; error?: string }> {
  const testPool = new Pool({ connectionString, ssl: { rejectUnauthorized: true } })
  try {
    await testPool.query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    await testPool.end()
  }
}
