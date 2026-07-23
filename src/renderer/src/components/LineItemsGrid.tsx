import type { CatalogItem } from '../../../shared/types'

export interface LineItemDraft {
  link: string
  description: string
  quantity: string
  unitPrice: string
  fetching: boolean
  fetchError: string | null
  fetchedLink: string | null
}

export function emptyLineItem(): LineItemDraft {
  return {
    link: '',
    description: '',
    quantity: '1',
    unitPrice: '',
    fetching: false,
    fetchError: null,
    fetchedLink: null
  }
}

export function lineItemDraftFrom(
  description: string,
  unitPriceCents: number,
  quantity = '1'
): LineItemDraft {
  return { ...emptyLineItem(), description, quantity, unitPrice: (unitPriceCents / 100).toFixed(2) }
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

  const runLinkFetch = async (index: number, url: string): Promise<void> => {
    updateItem(index, { link: url, fetching: true, fetchError: null })
    const result = await window.api.catalog.scrapeUrl(url)
    if (!result.ok || !result.product || (!result.product.name && result.product.priceCents === null)) {
      updateItem(index, { fetching: false, fetchError: result.error ?? "Couldn't read that page." })
      return
    }
    const { product } = result
    onChange(
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              fetching: false,
              fetchError: null,
              fetchedLink: url,
              description: product.name ?? item.description,
              unitPrice:
                product.priceCents !== null ? (product.priceCents / 100).toFixed(2) : item.unitPrice
            }
          : item
      )
    )
  }

  const onLinkPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>): void => {
    const pasted = e.clipboardData.getData('text').trim()
    if (!pasted || !/^https?:\/\//i.test(pasted)) return
    e.preventDefault()
    runLinkFetch(index, pasted)
  }

  const onLinkDrop = (index: number, e: React.DragEvent<HTMLInputElement>): void => {
    e.preventDefault()
    const dropped = (
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text')
    ).trim()
    if (!dropped || !/^https?:\/\//i.test(dropped)) return
    runLinkFetch(index, dropped)
  }

  const onLinkBlur = (index: number): void => {
    const row = items[index]
    const url = row.link.trim()
    if (!url || url === row.fetchedLink || row.fetching) return
    runLinkFetch(index, url)
  }

  return (
    <div>
      <label className="mb-2 block text-xs text-neutral-400">
        Line items — paste or drop a product link into a row to auto-fill it
      </label>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
            <tr>
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
                <td className="border-r border-neutral-800 align-top">
                  <div className="flex items-center gap-1.5 px-2 py-2">
                    <input
                      value={item.link}
                      onChange={(e) => updateItem(index, { link: e.target.value })}
                      onPaste={(e) => onLinkPaste(index, e)}
                      onDrop={(e) => onLinkDrop(index, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onBlur={() => onLinkBlur(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          onLinkBlur(index)
                        }
                      }}
                      disabled={disabled || item.fetching}
                      placeholder="Paste or drop a link…"
                      className="w-36 bg-transparent text-xs text-neutral-300 outline-none placeholder:text-neutral-600 disabled:opacity-50"
                    />
                    {item.fetching && (
                      <span className="shrink-0 text-[10px] text-primary">Fetching…</span>
                    )}
                  </div>
                  {item.fetchError && (
                    <div className="px-2 pb-1.5 text-[10px] text-red-400">{item.fetchError}</div>
                  )}
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
