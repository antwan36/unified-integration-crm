import { dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import { listContacts } from './db/contacts'
import { listAllInvoices } from './db/invoices'

function csvCell(value: string | number | boolean | null): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function toCsv(headers: string[], rows: (string | number | boolean | null)[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return lines.join('\n')
}

async function saveCsv(defaultName: string, csv: string): Promise<{ ok: boolean; path?: string }> {
  const win = BrowserWindow.getFocusedWindow() ?? undefined
  const { canceled, filePath } = await dialog.showSaveDialog(win as BrowserWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (canceled || !filePath) return { ok: false }
  writeFileSync(filePath, csv, 'utf-8')
  return { ok: true, path: filePath }
}

export async function exportContactsCsv(): Promise<{ ok: boolean; path?: string }> {
  const contacts = await listContacts({})
  const csv = toCsv(
    ['Name', 'Email', 'Phone', 'Source', 'Status', 'Job type', 'Address', 'Notes', 'Created', 'Updated'],
    contacts.map((c) => [
      c.name,
      c.email,
      c.phone,
      c.source,
      c.status,
      c.jobType,
      c.address,
      c.notes,
      c.createdAt,
      c.updatedAt
    ])
  )
  return saveCsv('contacts.csv', csv)
}

export async function exportInvoicesCsv(): Promise<{ ok: boolean; path?: string }> {
  const invoices = await listAllInvoices()
  const csv = toCsv(
    [
      'Contact',
      'Title',
      'Invoice number',
      'Status',
      'Due date',
      'Subtotal',
      'Tax %',
      'Total',
      'Created',
      'Updated'
    ],
    invoices.map((inv) => [
      inv.contactName,
      inv.title,
      inv.invoiceNumber,
      inv.status,
      inv.dueDate,
      (inv.subtotalCents / 100).toFixed(2),
      inv.taxPercent,
      (inv.totalCents / 100).toFixed(2),
      inv.createdAt,
      inv.updatedAt
    ])
  )
  return saveCsv('invoices.csv', csv)
}
