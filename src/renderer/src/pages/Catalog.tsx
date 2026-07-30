import { useEffect, useState } from 'react'
import type { CatalogItem } from '../../../shared/types'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface ItemForm {
  name: string
  description: string
  unitPrice: string
}

function emptyForm(): ItemForm {
  return { name: '', description: '', unitPrice: '' }
}

function toForm(item: CatalogItem): ItemForm {
  return {
    name: item.name,
    description: item.description ?? '',
    unitPrice: (item.unitPriceCents / 100).toFixed(2)
  }
}

export default function Catalog(): React.JSX.Element {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<ItemForm>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchedIncomplete, setFetchedIncomplete] = useState(false)

  const load = async (): Promise<void> => {
    setItems(await window.api.catalog.list())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const onFetchLink = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!linkUrl.trim()) return
    setFetching(true)
    setFetchError(null)
    setFetchedIncomplete(false)
    try {
      const result = await window.api.catalog.scrapeUrl(linkUrl.trim())
      if (!result.ok || !result.product) {
        setFetchError(result.error ?? 'Could not read that page.')
        return
      }
      const { product } = result
      setCreateForm({
        name: product.name ?? '',
        description: product.description ?? '',
        unitPrice: product.priceCents !== null ? (product.priceCents / 100).toFixed(2) : ''
      })
      setCreating(true)
      setLinkUrl('')
      if (!product.name || product.priceCents === null) setFetchedIncomplete(true)
    } finally {
      setFetching(false)
    }
  }

  const onCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!createForm.name.trim() || !Number(createForm.unitPrice)) return
    setSaving(true)
    try {
      await window.api.catalog.create({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        unitPriceCents: Math.round(Number(createForm.unitPrice) * 100)
      })
      setCreateForm(emptyForm())
      setCreating(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: CatalogItem): void => {
    setEditingId(item.id)
    setEditForm(toForm(item))
  }

  const onSaveEdit = async (id: string): Promise<void> => {
    if (!editForm.name.trim() || !Number(editForm.unitPrice)) return
    setSaving(true)
    try {
      await window.api.catalog.update(id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        unitPriceCents: Math.round(Number(editForm.unitPrice) * 100)
      })
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string): Promise<void> => {
    if (!confirm('Delete this catalog item?')) return
    await window.api.catalog.delete(id)
    await load()
  }

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Catalog</h1>
          <p className="mt-1 text-xs text-neutral-500">
            Items and prices you install often — pick them off this list when building an invoice
            or quote instead of typing everything out each time.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black"
        >
          + Add item
        </button>
      </div>

      <form onSubmit={onFetchLink} className="mt-4 flex gap-2">
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Paste a product link to auto-fill name and price…"
          className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={fetching || !linkUrl.trim()}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {fetching ? 'Fetching…' : 'Fetch details'}
        </button>
      </form>
      {fetchError && <p className="mt-2 text-xs text-red-400">{fetchError}</p>}
      {fetchedIncomplete && !fetchError && (
        <p className="mt-2 text-xs text-amber-400">
          Couldn't find everything on that page — double-check the name and price below before
          saving.
        </p>
      )}

      {creating && (
        <form
          onSubmit={onCreate}
          className="mt-4 flex items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-400">Name</label>
            <input
              autoFocus
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="4K Security Camera"
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-400">Description (optional)</label>
            <input
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs text-neutral-400">Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={createForm.unitPrice}
              onChange={(e) => setCreateForm({ ...createForm, unitPrice: e.target.value })}
              placeholder="0.00"
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !createForm.name.trim() || !Number(createForm.unitPrice)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Save
          </button>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {items.map((item) =>
              editingId === item.id ? (
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
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.unitPrice}
                      onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                      className="w-24 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-primary"
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
                <tr key={item.id} className="hover:bg-neutral-900">
                  <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-4 py-3 text-neutral-400">{item.description ?? '—'}</td>
                  <td className="px-4 py-3 text-neutral-400">{formatCents(item.unitPriceCents)}</td>
                  <td className="px-4 py-3 text-right">
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
              )
            )}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  No catalog items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
