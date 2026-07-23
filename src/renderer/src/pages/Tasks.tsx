import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Contact, TaskWithContactName } from '../../../shared/types'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function effectiveDateStr(task: TaskWithContactName): string | null {
  return task.dueDate ?? (task.startAt ? task.startAt.slice(0, 10) : null)
}

function groupTasks(tasks: TaskWithContactName[]): {
  overdue: TaskWithContactName[]
  today: TaskWithContactName[]
  upcoming: TaskWithContactName[]
  noDueDate: TaskWithContactName[]
} {
  const today = todayStr()
  const overdue: TaskWithContactName[] = []
  const dueToday: TaskWithContactName[] = []
  const upcoming: TaskWithContactName[] = []
  const noDueDate: TaskWithContactName[] = []

  for (const task of tasks) {
    const date = effectiveDateStr(task)
    if (!date) noDueDate.push(task)
    else if (date < today) overdue.push(task)
    else if (date === today) dueToday.push(task)
    else upcoming.push(task)
  }

  return { overdue, today: dueToday, upcoming, noDueDate }
}

function formatTimeRange(task: TaskWithContactName): string {
  if (!task.startAt) return ''
  const start = new Date(task.startAt)
  const startStr = start.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
  if (!task.endAt) return startStr
  const end = new Date(task.endAt)
  const endStr = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${startStr}–${endStr}`
}

function TaskGroup({
  title,
  tasks,
  emphasize,
  onComplete
}: {
  title: string
  tasks: TaskWithContactName[]
  emphasize?: boolean
  onComplete: (id: string) => void
}): React.JSX.Element | null {
  if (tasks.length === 0) return null

  return (
    <div className="mb-6">
      <h2
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${emphasize ? 'text-red-400' : 'text-neutral-500'}`}
      >
        {title} · {tasks.length}
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
          >
            <input
              type="checkbox"
              checked={false}
              onChange={() => onComplete(task.id)}
              className="h-4 w-4"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-white">
                {task.startAt && <span className="mr-1">📅</span>}
                {task.title}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/contacts/${task.contactId}`}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  {task.contactName}
                </Link>
                {task.location && (
                  <span className="text-xs text-neutral-600">· {task.location}</span>
                )}
              </div>
            </div>
            {task.startAt ? (
              <span className="text-xs text-neutral-400">{formatTimeRange(task)}</span>
            ) : (
              task.dueDate && (
                <span className="text-xs text-neutral-500">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Tasks(): React.JSX.Element {
  const [tasks, setTasks] = useState<TaskWithContactName[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [scheduled, setScheduled] = useState(false)
  const [newContactId, setNewContactId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newStartAt, setNewStartAt] = useState('')
  const [newEndAt, setNewEndAt] = useState('')
  const [newLocation, setNewLocation] = useState('')

  const load = async (): Promise<void> => {
    const [openTasks, contactList] = await Promise.all([
      window.api.tasks.listOpen(),
      window.api.contacts.list()
    ])
    setTasks(openTasks)
    setContacts(contactList)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const onComplete = async (id: string): Promise<void> => {
    setTasks((current) => current.filter((t) => t.id !== id))
    await window.api.tasks.setDone(id, true)
  }

  const onAddTask = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newContactId || !newTitle.trim()) return
    if (scheduled && !newStartAt) return
    await window.api.tasks.create({
      contactId: newContactId,
      title: newTitle.trim(),
      dueDate: scheduled ? null : newDueDate || null,
      startAt: scheduled && newStartAt ? new Date(newStartAt).toISOString() : null,
      endAt: scheduled && newEndAt ? new Date(newEndAt).toISOString() : null,
      location: scheduled ? newLocation.trim() || null : null
    })
    setNewTitle('')
    setNewDueDate('')
    setNewStartAt('')
    setNewEndAt('')
    setNewLocation('')
    setAdding(false)
    load()
  }

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  const grouped = groupTasks(tasks)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Tasks</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Follow-ups and scheduled appointments across every contact.
          </p>
        </div>
        <button
          onClick={() => {
            if (!adding && !newContactId && contacts.length > 0) setNewContactId(contacts[0].id)
            setAdding((v) => !v)
          }}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={onAddTask}
          className="mt-4 space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <div className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Contact</label>
              <select
                value={newContactId}
                onChange={(e) => setNewContactId(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-neutral-400">
                {scheduled ? 'Appointment' : 'Task'}
              </label>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={scheduled ? 'Install at…' : 'Follow up about…'}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(e) => setScheduled(e.target.checked)}
            />
            This has a specific time (appointment/site visit)
          </label>

          {scheduled ? (
            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Starts</label>
                <input
                  type="datetime-local"
                  value={newStartAt}
                  onChange={(e) => setNewStartAt(e.target.value)}
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Ends (optional)</label>
                <input
                  type="datetime-local"
                  value={newEndAt}
                  onChange={(e) => setNewEndAt(e.target.value)}
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-neutral-400">Location (optional)</label>
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="123 Main St"
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Due date (optional)</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newContactId || !newTitle.trim() || (scheduled && !newStartAt)}
              className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </form>
      )}
      {adding && contacts.length === 0 && (
        <p className="mt-2 text-xs text-amber-400">Add a contact first — tasks need one to attach to.</p>
      )}

      <div className="mt-6">
        <TaskGroup title="Overdue" tasks={grouped.overdue} emphasize onComplete={onComplete} />
        <TaskGroup title="Due today" tasks={grouped.today} onComplete={onComplete} />
        <TaskGroup title="Upcoming" tasks={grouped.upcoming} onComplete={onComplete} />
        <TaskGroup title="No due date" tasks={grouped.noDueDate} onComplete={onComplete} />
        {tasks.length === 0 && (
          <p className="text-sm text-neutral-500">Nothing outstanding — you're all caught up.</p>
        )}
      </div>
    </div>
  )
}
