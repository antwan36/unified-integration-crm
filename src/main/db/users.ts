import bcrypt from 'bcryptjs'
import { getDb } from './index'
import { newId } from './ids'
import type { AuthUser, TeamMember } from '../../shared/types'

interface UserRow {
  id: string
  email: string
  passwordHash: string
  name: string
  role: string
  createdAt: Date
}

export async function countUsers(): Promise<number> {
  const result = await getDb().query<{ count: string }>('SELECT COUNT(*) as count FROM users')
  return Number(result.rows[0].count)
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: string = 'owner'
): Promise<AuthUser> {
  const passwordHash = bcrypt.hashSync(password, 10)
  const id = newId()
  await getDb().query(
    `INSERT INTO users (id, email, "passwordHash", name, role) VALUES ($1, $2, $3, $4, $5)`,
    [id, email.toLowerCase().trim(), passwordHash, name, role]
  )
  return { id, email, name }
}

export async function listUsers(): Promise<TeamMember[]> {
  const result = await getDb().query<UserRow>(
    'SELECT * FROM users ORDER BY "createdAt" ASC'
  )
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt.toISOString()
  }))
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const result = await getDb().query<UserRow>('SELECT * FROM users WHERE email = $1', [
    email.toLowerCase().trim()
  ])
  const row = result.rows[0]
  return row ? { id: row.id, email: row.email, name: row.name } : null
}

export async function deleteUser(id: string): Promise<void> {
  const count = await countUsers()
  if (count <= 1) throw new Error('Cannot delete the last remaining account')
  await getDb().query('DELETE FROM users WHERE id = $1', [id])
}

export async function verifyLogin(email: string, password: string): Promise<AuthUser | null> {
  const result = await getDb().query<UserRow>('SELECT * FROM users WHERE email = $1', [
    email.toLowerCase().trim()
  ])
  const row = result.rows[0]
  if (!row) return null
  if (!bcrypt.compareSync(password, row.passwordHash)) return null
  return { id: row.id, email: row.email, name: row.name }
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = bcrypt.hashSync(newPassword, 10)
  await getDb().query('UPDATE users SET "passwordHash" = $1 WHERE id = $2', [passwordHash, userId])
}
