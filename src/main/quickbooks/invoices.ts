import { quickBooksQuery, quickBooksRequest } from './client'
import type { InvoiceWithLineItems } from '../../shared/types'

interface QuickBooksAccount {
  Id: string
  Name: string
}

interface AccountQueryResponse {
  QueryResponse?: { Account?: QuickBooksAccount[] }
}

interface QuickBooksItem {
  Id: string
}

interface ItemQueryResponse {
  QueryResponse?: { Item?: QuickBooksItem[] }
}

const MIGRATION_ITEM_NAME = 'Migrated Invoice Item'

async function findIncomeAccountId(realmId: string): Promise<string> {
  const data = await quickBooksQuery<AccountQueryResponse>(
    realmId,
    "SELECT Id, Name FROM Account WHERE AccountType = 'Income' MAXRESULTS 1"
  )
  const account = data.QueryResponse?.Account?.[0]
  if (!account) {
    throw new Error(
      'No Income account exists in this QuickBooks company yet — create one (e.g. "Sales" or "Services") before running the migration.'
    )
  }
  return account.Id
}

/**
 * All migrated line items are billed against a single generic Service item so
 * dollar totals land correctly without needing to guess at the user's real
 * QuickBooks item/product catalog — the original Square line-item text is kept
 * in each line's Description.
 */
async function ensureMigrationItem(realmId: string): Promise<string> {
  const existing = await quickBooksQuery<ItemQueryResponse>(
    realmId,
    `SELECT Id FROM Item WHERE Name = '${MIGRATION_ITEM_NAME}'`
  )
  const existingId = existing.QueryResponse?.Item?.[0]?.Id
  if (existingId) return existingId

  const incomeAccountId = await findIncomeAccountId(realmId)
  const created = await quickBooksRequest<{ Item: QuickBooksItem }>(
    'POST',
    `/v3/company/${realmId}/item`,
    {
      Name: MIGRATION_ITEM_NAME,
      Type: 'Service',
      IncomeAccountRef: { value: incomeAccountId }
    }
  )
  return created.Item.Id
}

interface QuickBooksInvoiceLine {
  Amount: number
  DetailType: 'SalesItemLineDetail'
  Description: string
  SalesItemLineDetail: { ItemRef: { value: string }; Qty: number; UnitPrice: number }
}

interface QuickBooksInvoice {
  Id: string
  DocNumber?: string
}

/**
 * Creates a QuickBooks Invoice reproducing a CRM invoice's line items, tax, and
 * shipping as plain dollar amounts (not QuickBooks' automated tax engine, which
 * needs jurisdiction-specific tax codes we don't have configured) — used by the
 * one-time Square history migration and, later, live invoice creation once the
 * user switches over.
 */
export async function createQuickBooksInvoiceFromLocal(
  realmId: string,
  customerId: string,
  local: InvoiceWithLineItems,
  privateNote: string
): Promise<QuickBooksInvoice> {
  const itemId = await ensureMigrationItem(realmId)

  const lines: QuickBooksInvoiceLine[] = local.lineItems.map((item) => ({
    Amount: Math.round(item.quantity * item.unitPriceCents) / 100,
    DetailType: 'SalesItemLineDetail',
    Description: item.description,
    SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: item.quantity, UnitPrice: item.unitPriceCents / 100 }
  }))

  if (local.shippingCents > 0) {
    lines.push({
      Amount: local.shippingCents / 100,
      DetailType: 'SalesItemLineDetail',
      Description: 'Shipping',
      SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: local.shippingCents / 100 }
    })
  }

  if (local.taxPercent > 0) {
    const taxCents = Math.round(local.subtotalCents * (local.taxPercent / 100))
    lines.push({
      Amount: taxCents / 100,
      DetailType: 'SalesItemLineDetail',
      Description: `Tax (${local.taxPercent}%)`,
      SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: taxCents / 100 }
    })
  }

  const body: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    TxnDate: local.createdAt.slice(0, 10),
    DueDate: local.dueDate,
    Line: lines,
    PrivateNote: privateNote
  }
  if (local.invoiceNumber) body.DocNumber = local.invoiceNumber

  try {
    const created = await quickBooksRequest<{ Invoice: QuickBooksInvoice }>(
      'POST',
      `/v3/company/${realmId}/invoice`,
      body
    )
    return created.Invoice
  } catch (err) {
    // DocNumber collisions happen if two Square invoices ever shared a number, or the
    // number collides with something already in QuickBooks — retry once without it
    // (QuickBooks auto-assigns one) rather than losing the whole migration on this invoice.
    if (body.DocNumber && err instanceof Error && /duplicate|DocNumber/i.test(err.message)) {
      const { DocNumber: _docNumber, ...withoutDocNumber } = body
      const created = await quickBooksRequest<{ Invoice: QuickBooksInvoice }>(
        'POST',
        `/v3/company/${realmId}/invoice`,
        withoutDocNumber
      )
      return created.Invoice
    }
    throw err
  }
}

export async function recordQuickBooksPayment(
  realmId: string,
  customerId: string,
  invoiceId: string,
  amountCents: number,
  txnDate: string
): Promise<void> {
  if (amountCents <= 0) return
  await quickBooksRequest('POST', `/v3/company/${realmId}/payment`, {
    CustomerRef: { value: customerId },
    TotalAmt: amountCents / 100,
    TxnDate: txnDate,
    Line: [
      {
        Amount: amountCents / 100,
        LinkedTxn: [{ TxnId: invoiceId, TxnType: 'Invoice' }]
      }
    ]
  })
}
