import {
  getSquareOrder,
  listAllSquareCustomers,
  listAllSquareInvoices,
  sumInvoicePaidCents,
  sumOrderRefundCents,
  type SquareCustomer,
  type SquareInvoiceSummary
} from './client'
import { loadSquareCredentials } from '../secrets/square-credentials'
import {
  createContact,
  findContactBySquareCustomerId,
  findContactByEmail,
  setSquareCustomerId
} from '../db/contacts'
import { upsertInvoiceFromSquare } from '../db/invoices'
import { queueReviewRequest } from '../db/reviewRequests'
import type {
  CreateInvoiceLineItemInput,
  InvoiceStatus,
  SquareCredentials,
  SquareSyncResult
} from '../../shared/types'

function customerName(customer: SquareCustomer): string {
  const parts = [customer.given_name, customer.family_name].filter(Boolean)
  if (parts.length) return parts.join(' ')
  if (customer.company_name) return customer.company_name
  if (customer.email_address) return customer.email_address
  if (customer.phone_number) return customer.phone_number
  return 'Square customer'
}

async function syncCustomers(
  customers: SquareCustomer[]
): Promise<{ created: number; linked: number }> {
  let created = 0
  let linked = 0

  for (const customer of customers) {
    const existing = await findContactBySquareCustomerId(customer.id)
    if (existing) continue

    if (customer.email_address) {
      const byEmail = await findContactByEmail(customer.email_address)
      if (byEmail) {
        await setSquareCustomerId(byEmail.id, customer.id)
        linked++
        continue
      }
    }

    const contact = await createContact({
      name: customerName(customer),
      email: customer.email_address ?? null,
      phone: customer.phone_number ?? null,
      source: 'square'
    })
    await setSquareCustomerId(contact.id, customer.id)
    created++
  }

  return { created, linked }
}

async function syncInvoices(
  creds: SquareCredentials,
  invoices: SquareInvoiceSummary[]
): Promise<{ created: number; updated: number; paid: number }> {
  let created = 0
  let updated = 0
  let paid = 0

  for (const invoice of invoices) {
    try {
      const customerId = invoice.primary_recipient?.customer_id
      if (!customerId) continue
      const contact = await findContactBySquareCustomerId(customerId)
      if (!contact) continue

      let subtotalCents = 0
      let totalCents = 0
      let refundedCents = 0
      let lineItems: CreateInvoiceLineItemInput[] = []
      if (invoice.order_id) {
        const order = await getSquareOrder(creds, invoice.order_id)
        if (order) {
          totalCents = order.total_money?.amount ?? 0
          refundedCents = sumOrderRefundCents(order.refunds)
          lineItems = (order.line_items ?? []).map((item) => ({
            description: item.name ?? 'Item',
            quantity: Number(item.quantity) || 1,
            unitPriceCents: item.base_price_money?.amount ?? 0
          }))
          subtotalCents = lineItems.reduce(
            (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
            0
          )
        }
      }

      const { id: invoiceId, inserted, becamePaid } = await upsertInvoiceFromSquare({
        contactId: contact.id,
        squareInvoiceId: invoice.id,
        squareOrderId: invoice.order_id ?? null,
        title: invoice.title ?? 'Invoice',
        dueDate: invoice.payment_requests?.[0]?.due_date ?? new Date().toISOString().slice(0, 10),
        subtotalCents,
        taxPercent: 0,
        shippingCents: 0,
        totalCents,
        paidCents: sumInvoicePaidCents(invoice.payment_requests),
        refundedCents,
        status: invoice.status as InvoiceStatus,
        invoiceNumber: invoice.invoice_number ?? null,
        publicUrl: invoice.public_url ?? null,
        lineItems
      })
      if (inserted) created++
      else updated++
      if (becamePaid) {
        paid++
        await queueReviewRequest(contact.id, invoiceId)
      }
    } catch (err) {
      console.error(`Failed to import Square invoice ${invoice.id}:`, err)
    }
  }

  return { created, updated, paid }
}

/**
 * One-time/on-demand pull of everything that already exists in Square but wasn't
 * created through this app — customers become contacts, invoices become local
 * invoice records (with line items). Safe to re-run: matches on squareCustomerId
 * and squareInvoiceId so nothing is duplicated.
 */
export async function runSquareSync(): Promise<SquareSyncResult> {
  const creds = await loadSquareCredentials()
  if (!creds) {
    return {
      ok: false,
      error: 'Square is not connected yet. Add your access token in Settings.',
      customersCreated: 0,
      customersLinked: 0,
      invoicesCreated: 0,
      invoicesUpdated: 0,
      invoicesPaid: 0
    }
  }

  try {
    const customers = await listAllSquareCustomers(creds)
    const customerResult = await syncCustomers(customers)

    const invoices = await listAllSquareInvoices(creds)
    const invoiceResult = await syncInvoices(creds, invoices)

    return {
      ok: true,
      customersCreated: customerResult.created,
      customersLinked: customerResult.linked,
      invoicesCreated: invoiceResult.created,
      invoicesUpdated: invoiceResult.updated,
      invoicesPaid: invoiceResult.paid
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      customersCreated: 0,
      customersLinked: 0,
      invoicesCreated: 0,
      invoicesUpdated: 0,
      invoicesPaid: 0
    }
  }
}
