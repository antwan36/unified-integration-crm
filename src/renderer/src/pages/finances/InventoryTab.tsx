import { Fragment, useEffect, useState } from 'react'
import type { InventoryItem } from '../../../../shared/types'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface ItemForm {
  name: string
  sku: string
  description: string
  category: string
  unitCost: string
  reorderThreshold: string
  location: string
}

function emptyForm(): ItemForm {
  return { name: '', sku: '', description: '', category: '', unitCost: '', reorderThreshold: '', location: '' }
}

function toForm(item: InventoryItem): ItemForm {
  return {
    name: item.name,
    sku: item.sku ?? '',
    description: item.description ?? '',
    category: item.category ?? '',
    unitCost: (item.unitCostCents / 100).toFixed(2),
    reorderThreshold: item.reorderThreshold != null ? String(item.reorderThreshold) : '',
    location: item.location ?? ''
  }
}

export default function InventoryTab(): React.JSX.Element {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<ItemForm>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [logForm, setLogForm] = useState({
    type: 'purchase' as 'purchase' | 'use' | 'adjustment' | 'return',
    quantity: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  })

  const load = async (): Promise<void> => {
    setItems(await window.api.inventory.list())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const onCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setSaving(true)
    try {
      await window.api.inventory.create({
        name: createForm.name.trim(),
        sku: createForm.sku.trim() || null,
        description: createForm.description.trim() || null,
        category: createForm.category.trim() || null,
        unitCostCents: Math.round(Number(createForm.unitCost || 0) * 100),
        reorderThreshold: createForm.reorderThreshold ? Number(createForm.reorderThreshold) : null,
        location: createForm.location.trim() || null
      })
      setCreateForm(emptyForm())
      setCreating(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: InventoryItem): void => {
    setEditingId(item.id)
    setEditForm(toForm(item))
  }

  const onSaveEdit = async (id: string): Promise<void> => {
    if (!editForm.name.trim()) return
    setSaving(true)
    try {
      await window.api.inventory.update(id, {
        name: editForm.name.trim(),
        sku: editForm.sku.trim() || null,
        description: editForm.description.trim() || null,
        category: editForm.category.trim() || null,
        unitCostCents: Math.round(Number(editForm.unitCost || 0) * 100),
        reorderThreshold: editForm.reorderThreshold ? Number(editForm.reorderThreshold) : null,
        location: editForm.location.trim() || null
      })
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string): Promise<void> => {
    if (!confirm('Delete this inventory item? This also removes its transaction history.')) return
    await window.api.inventory.delete(id)
    await load()
  }

  const startLog = (id: string): void => {
    setLoggingId(id)
    setLogForm({ type: 'purchase', quantity: '', date: new Date().toISOString().slice(0, 10), notes: '' })
  }

  const onSaveLog = async (itemId: string): Promise<void> => {
    const qty = Number(logForm.quantity)
    if (!qty) return
    setSaving(true)
    try {
      const signed = logForm.type === 'use' ? -Math.abs(qty) : Math.abs(qty)
      await window.api.inventory.recordTransaction({
        itemId,
        type: logForm.type,
        quantityDelta: logForm.type === 'adjustment' ? qty : signed,
        date: logForm.date,
        notes: logForm.notes.trim() || null
      })
      setLoggingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Inventory</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Gear and parts you own or keep in stock — track what's on hand and what it cost.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
        >
          + Add item
        </button>
      </div>

      {creating && (
        <form
          onSubmit={onCreate}
          className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Name</label>
            <input
              autoFocus
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">SKU (optional)</label>
            <input
              value={createForm.sku}
              onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Category</label>
            <input
              value={createForm.category}
              onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Unit cost</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={createForm.unitCost}
              onChange={(e) => setCreateForm({ ...createForm, unitCost: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Reorder threshold</label>
            <input
              type="number"
              min="0"
              value={createForm.reorderThreshold}
              onChange={(e) => setCreateForm({ ...createForm, reorderThreshold: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Location</label>
            <input
              value={createForm.location}
              onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
              placeholder="Van 1, warehouse shelf B…"
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="col-span-3">
            <button
              type="submit"
              disabled={saving || !createForm.name.trim()}
              className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">On hand</th>
              <th className="px-4 py-2 font-medium">Unit cost</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {items.map((item) => {
              const lowStock = item.reorderThreshold != null && item.quantityOnHand <= item.reorderThreshold
              return editingId === item.id ? (
                <tr key={item.id} className="bg-neutral-900/50">
                  <td className="px-4 py-2">
                    <input
                      autoFocus
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-neutral-400">{item.quantityOnHand}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.unitCost}
                      onChange={(e) => setEditForm({ ...editForm, unitCost: e.target.value })}
                      className="w-24 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => onSaveEdit(item.id)}
                      disabled={saving}
                      className="mr-3 text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-neutral-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <Fragment key={item.id}>
                  <tr className="hover:bg-neutral-900">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3 text-neutral-400">{item.category ?? '—'}</td>
                    <td className={`px-4 py-3 ${lowStock ? 'text-amber-400' : 'text-neutral-400'}`}>
                      {item.quantityOnHand}
                      {lowStock && ' ⚠ low'}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">{formatCents(item.unitCostCents)}</td>
                    <td className="px-4 py-3 text-neutral-400">{item.location ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => (loggingId === item.id ? setLoggingId(null) : startLog(item.id))}
                        className="mr-3 text-xs text-neutral-400 hover:text-white"
                      >
                        Log
                      </button>
                      <button
                        onClick={() => startEdit(item)}
                        className="mr-3 text-xs text-neutral-400 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {loggingId === item.id && (
                    <tr className="bg-neutral-900/50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-neutral-400">Type</label>
                            <select
                              value={logForm.type}
                              onChange={(e) =>
                                setLogForm({ ...logForm, type: e.target.value as typeof logForm.type })
                              }
                              className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                            >
                              <option value="purchase">Purchase (add stock)</option>
                              <option value="use">Use (remove stock)</option>
                              <option value="return">Return (add stock)</option>
                              <option value="adjustment">Adjustment (+/-)</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-neutral-400">Quantity</label>
                            <input
                              type="number"
                              step="any"
                              value={logForm.quantity}
                              onChange={(e) => setLogForm({ ...logForm, quantity: e.target.value })}
                              className="w-24 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-neutral-400">Date</label>
                            <input
                              type="date"
                              value={logForm.date}
                              onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                              className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="mb-1 block text-xs text-neutral-400">Notes (optional)</label>
                            <input
                              value={logForm.notes}
                              onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                            />
                          </div>
                          <button
                            onClick={() => onSaveLog(item.id)}
                            disabled={saving || !logForm.quantity}
                            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
                          >
                            Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No inventory items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
