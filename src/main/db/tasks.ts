import { getDb } from './index'
import { newId } from './ids'
import type { CreateTaskInput, Task, TaskWithContactName } from '../../shared/types'

interface TaskRow {
  id: string
  contactId: string
  title: string
  dueDate: string | null
  done: boolean
  completedAt: Date | null
  createdAt: Date
  startAt: Date | null
  endAt: Date | null
  location: string | null
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    contactId: row.contactId,
    title: row.title,
    dueDate: row.dueDate,
    done: row.done,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    startAt: row.startAt ? row.startAt.toISOString() : null,
    endAt: row.endAt ? row.endAt.toISOString() : null,
    location: row.location
  }
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const id = newId()
  const result = await getDb().query<TaskRow>(
    `INSERT INTO tasks (id, "contactId", title, "dueDate", "startAt", "endAt", location)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      input.contactId,
      input.title,
      input.dueDate ?? null,
      input.startAt ?? null,
      input.endAt ?? null,
      input.location ?? null
    ]
  )
  return toTask(result.rows[0])
}

export async function listTasksForContact(contactId: string): Promise<Task[]> {
  const result = await getDb().query<TaskRow>(
    `SELECT * FROM tasks WHERE "contactId" = $1
     ORDER BY done ASC, "startAt" ASC NULLS LAST, "dueDate" ASC NULLS LAST, "createdAt" ASC`,
    [contactId]
  )
  return result.rows.map(toTask)
}

export async function listOpenTasks(): Promise<TaskWithContactName[]> {
  const result = await getDb().query<TaskRow & { contactName: string }>(
    `SELECT t.*, c.name as "contactName"
     FROM tasks t JOIN contacts c ON c.id = t."contactId"
     WHERE t.done = false
     ORDER BY t."startAt" ASC NULLS LAST, t."dueDate" ASC NULLS LAST, t."createdAt" ASC`
  )
  return result.rows.map((row) => ({ ...toTask(row), contactName: row.contactName }))
}

export async function getTask(id: string): Promise<Task | null> {
  const result = await getDb().query<TaskRow>('SELECT * FROM tasks WHERE id = $1', [id])
  return result.rows[0] ? toTask(result.rows[0]) : null
}

export async function setTaskDone(id: string, done: boolean): Promise<Task | null> {
  const result = await getDb().query<TaskRow>(
    `UPDATE tasks SET done = $1, "completedAt" = CASE WHEN $1 THEN now() ELSE NULL END
     WHERE id = $2
     RETURNING *`,
    [done, id]
  )
  return result.rows[0] ? toTask(result.rows[0]) : null
}

export async function deleteTask(id: string): Promise<void> {
  await getDb().query('DELETE FROM tasks WHERE id = $1', [id])
}

export async function countOpenDueOrOverdue(): Promise<{ overdue: number; dueToday: number }> {
  const result = await getDb().query<{ overdue: string; dueToday: string }>(
    `SELECT
      COUNT(*) FILTER (WHERE done = false AND "dueDate" < to_char(now(), 'YYYY-MM-DD')) AS overdue,
      COUNT(*) FILTER (WHERE done = false AND "dueDate" = to_char(now(), 'YYYY-MM-DD')) AS "dueToday"
     FROM tasks`
  )
  return {
    overdue: Number(result.rows[0].overdue),
    dueToday: Number(result.rows[0].dueToday)
  }
}
