import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contact, TaskWithContactName } from '../../../shared/types'

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function effectiveDateKey(task: TaskWithContactName): string | null {
  if (task.startAt) return toDateKey(new Date(task.startAt))
  if (task.dueDate) return task.dueDate
  return null
}

function buildGridDays(monthStart: Date): Date[] {
  const firstOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay())

  const days: Date[] = []
  const cursor = new Date(gridStart)
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_PER_DAY = 3

export default function Calendar(): React.JSX.Element {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskWithContactName[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const [formDay, setFormDay] = useState<string | null>(null)
  const [formContactId, setFormContactId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formScheduled, setFormScheduled] = useState(true)
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [saving, setSaving] = useState(false)

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

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithContactName[]>()
    for (const task of tasks) {
      const key = effectiveDateKey(task)
      if (!key) continue
      const existing = map.get(key)
      if (existing) existing.push(task)
      else map.set(key, [task])
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.startAt && b.startAt) return a.startAt.localeCompare(b.startAt)
        if (a.startAt) return -1
        if (b.startAt) return 1
        return 0
      })
    }
    return map
  }, [tasks])

  const days = useMemo(() => buildGridDays(monthCursor), [monthCursor])
  const todayKey = toDateKey(new Date())
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const goToMonth = (delta: number): void => {
    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
    setExpandedDay(null)
  }

  const goToToday = (): void => {
    const now = new Date()
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1))
    setExpandedDay(null)
  }

  const openForm = (dateKey: string): void => {
    setFormDay(dateKey)
    setFormContactId(contacts[0]?.id ?? '')
    setFormTitle('')
    setFormScheduled(true)
    setFormStart('09:00')
    setFormEnd('')
    setFormLocation('')
  }

  const closeForm = (): void => setFormDay(null)

  const onSubmitForm = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!formDay || !formContactId || !formTitle.trim()) return
    if (formScheduled && !formStart) return
    setSaving(true)
    try {
      const startAt = formScheduled ? new Date(`${formDay}T${formStart}`).toISOString() : null
      const endAt = formScheduled && formEnd ? new Date(`${formDay}T${formEnd}`).toISOString() : null
      await window.api.tasks.create({
        contactId: formContactId,
        title: formTitle.trim(),
        dueDate: formScheduled ? null : formDay,
        startAt,
        endAt,
        location: formScheduled ? formLocation.trim() || null : null
      })
      closeForm()
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Calendar</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Scheduled appointments and follow-ups across every contact.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToMonth(-1)}
            className="rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-white hover:bg-neutral-800"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
          >
            Today
          </button>
          <button
            onClick={() => goToMonth(1)}
            className="rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-white hover:bg-neutral-800"
          >
            →
          </button>
          <span className="ml-2 min-w-[9rem] text-sm font-medium text-white">{monthLabel}</span>
          <button
            onClick={() => openForm(todayKey)}
            disabled={contacts.length === 0}
            className="ml-2 rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>
      {contacts.length === 0 && (
        <p className="mt-2 text-xs text-amber-400">Add a contact first — events need one to attach to.</p>
      )}

      {formDay && (
        <form
          onSubmit={onSubmitForm}
          className="mt-4 space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">{formatDayLabel(formDay)}</span>
            <button type="button" onClick={closeForm} className="text-xs text-neutral-500 hover:text-white">
              Cancel
            </button>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Contact</label>
              <select
                value={formContactId}
                onChange={(e) => setFormContactId(e.target.value)}
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
                {formScheduled ? 'Appointment' : 'Task'}
              </label>
              <input
                autoFocus
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={formScheduled ? 'Install at…' : 'Follow up about…'}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={formScheduled}
              onChange={(e) => setFormScheduled(e.target.checked)}
            />
            This has a specific time (appointment/site visit)
          </label>

          {formScheduled && (
            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Starts</label>
                <input
                  type="time"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Ends (optional)</label>
                <input
                  type="time"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-neutral-400">Location (optional)</label>
                <input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="123 Main St"
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !formContactId || !formTitle.trim() || (formScheduled && !formStart)}
              className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid grid-cols-7 overflow-hidden rounded-lg border border-neutral-800">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-neutral-800 bg-neutral-900 px-2 py-2 text-center text-xs font-medium text-neutral-500"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = toDateKey(day)
          const inMonth = day.getMonth() === monthCursor.getMonth()
          const isToday = key === todayKey
          const dayTasks = tasksByDay.get(key) ?? []
          const expanded = expandedDay === key
          const visible = expanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE_PER_DAY)
          const hidden = dayTasks.length - visible.length

          return (
            <div
              key={key}
              className={`group min-h-[7rem] border-b border-r border-neutral-800 p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0 ${
                inMonth ? 'bg-neutral-950' : 'bg-neutral-950/40'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <div
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? 'bg-primary font-semibold text-black'
                      : inMonth
                        ? 'text-neutral-400'
                        : 'text-neutral-700'
                  }`}
                >
                  {day.getDate()}
                </div>
                <button
                  onClick={() => openForm(key)}
                  disabled={contacts.length === 0}
                  title="Add event"
                  className="hidden h-4 w-4 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:hidden group-hover:flex"
                >
                  +
                </button>
              </div>
              <div className="space-y-1">
                {visible.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => navigate(`/contacts/${task.contactId}`)}
                    title={`${task.title} — ${task.contactName}`}
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight ${
                      task.startAt
                        ? 'bg-primary/15 text-primary hover:bg-primary/25'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {task.startAt && <span className="mr-1 opacity-80">{formatTime(task.startAt)}</span>}
                    {task.title}
                  </button>
                ))}
                {hidden > 0 && (
                  <button
                    onClick={() => setExpandedDay(key)}
                    className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-neutral-500 hover:text-white"
                  >
                    +{hidden} more
                  </button>
                )}
                {expanded && dayTasks.length > MAX_VISIBLE_PER_DAY && (
                  <button
                    onClick={() => setExpandedDay(null)}
                    className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-neutral-500 hover:text-white"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/40" /> Scheduled appointment
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-neutral-700" /> Follow-up (no set time)
        </span>
      </div>
    </div>
  )
}
