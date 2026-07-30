import type { CatalogItem } from '../../../shared/types'

export interface LineItemDraft {
  link: string
  description: string
  quantity: string
  unitPrice: string
}

export function emptyLineItem(): LineItemDraft {
  return {
    link: '',
    description: '',
    quantity: '1',
    unitPrice: ''
  }
}

export function lineItemDraftFrom(
  description: string,
  unitPriceCents: number,
  quantity = '1',
  link = ''
): LineItemDraft {
  return { ...emptyLineItem(), description, quantity, unitPrice: (unitPriceCents / 100).toFixed(2), link }
}

interface Props {
  items: LineItemDraft[]
  onChange: (items: LineItemDraft[]) => void
  catalogItems: CatalogItem[]
  disabled?: boolean
}

export default function LineItemsGrid({
  items,
  onChange,
  catalogItems,
  disabled
}: Props): React.JSX.Element {
  const updateItem = (index: number, patch: Partial<LineItemDraft>): void => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addItem = (): void => onChange([...items, emptyLineItem()])

  const addDraft = (draft: LineItemDraft): void => {
    const isBlankSingle =
      items.length === 1 &&
      !items[0].description.trim() &&
      !items[0].unitPrice.trim() &&
      !items[0].link.trim()
    onChange(isBlankSingle ? [draft] : [...items, draft])
  }

  const addFromCatalog = (catalogItemId: string): void => {
    const item = catalogItems.find((c) => c.id === catalogItemId)
    if (!item) return
    addDraft(lineItemDraftFrom(item.name, item.unitPriceCents))
  }

  const removeItem = (index: number): void => onChange(items.filter((_, i) => i !== index))

  const moveItem = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      <label className="mb-2 block text-xs text-neutral-400">Line items</label>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
              {!disabled && <th className="w-8" />}
              <th className="px-2 py-2 font-medium">Link</th>
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 font-medium">Qty</th>
              <th className="px-2 py-2 font-medium">Price</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {items.map((item, index) => (
              <tr key={index} className="bg-neutral-950">
                {!disabled && (
                  <td className="border-r border-neutral-800 px-1 text-center align-middle">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                        className="text-neutral-500 hover:text-white disabled:opacity-20"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        title="Move down"
                        className="text-neutral-500 hover:text-white disabled:opacity-20"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                )}
                <td className="border-r border-neutral-800 align-top">
                  <input
                    value={item.link}
                    onChange={(e) => updateItem(index, { link: e.target.value })}
                    disabled={disabled}
                    placeholder="Product link (optional)…"
                    className="w-36 bg-transparent px-2 py-2 text-xs text-neutral-300 outline-none placeholder:text-neutral-600 disabled:opacity-50"
                  />
                </td>
                <td className="border-r border-neutral-800">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Description"
                    disabled={disabled}
                    className="w-full min-w-[12rem] bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-neutral-600 disabled:opacity-60"
                  />
                </td>
                <td className="border-r border-neutral-800">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    disabled={disabled}
                    className="w-14 bg-transparent px-2 py-2 text-sm text-white outline-none disabled:opacity-60"
                  />
                </td>
                <td className="border-r border-neutral-800">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                    placeholder="0.00"
                    disabled={disabled}
                    className="w-24 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-neutral-600 disabled:opacity-60"
                  />
                </td>
                <td className="px-2 py-2 text-right text-sm text-neutral-300">
                  ${((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}
                </td>
                <td className="px-1 text-right">
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="px-1 text-neutral-500 hover:text-red-400 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div className="no-print mt-2 flex items-center gap-3">
          <button type="button" onClick={addItem} className="text-xs text-neutral-400 hover:text-white">
            + Add row
          </button>
          {catalogItems.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && addFromCatalog(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-400 outline-none focus:border-primary"
            >
              <option value="">+ Add from catalog…</option>
              {catalogItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — ${(c.unitPriceCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}
