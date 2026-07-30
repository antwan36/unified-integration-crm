import { Pool } from 'pg'
import { SCHEMA_SQL } from './schema'

let pool: Pool | null = null

export function initDb(connectionString: string): Pool {
  pool = new Pool({ connectionString, ssl: { rejectUnauthorized: true } })
  // Required by pg: without this, a dropped idle connection (network blip,
  // laptop sleep/wake) emits an unhandled 'error' that crashes the whole
  // process instead of just failing the next query that needs a new client.
  pool.on('error', (err) => {
    console.error('Idle Postgres client error (connection will be replaced):', err)
  })
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
  testPool.on('error', (err) => console.error('Idle test-connection client error:', err))
  try {
    await testPool.query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    await testPool.end()
  }
}
