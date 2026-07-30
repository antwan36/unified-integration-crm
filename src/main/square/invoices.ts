import { randomUUID } from 'crypto'
import {
  squareRequest,
  getSquareOrder,
  sumInvoicePaidCents,
  sumOrderRefundCents,
  SquareApiError
} from './client'
import { loadSquareCredentials } from '../secrets/square-credentials'
import { getContact, getSquareCustomerId, setSquareCustomerId } from '../db/contacts'
import {
  createInvoiceRecord,
  deleteInvoiceRecord,
  getInvoice,
  updateInvoiceStatus
} from '../db/invoices'
import { createActivity } from '../db/activities'
import type {
  CreateInvoiceInput,
  InvoiceStatus,
  InvoiceWithLineItems,
  SquareCredentials
} from '../../shared/types'

interface SquareCustomer {
  id: string
}

interface SquareOrder {
  id: string
  total_money?: { amount: number }
}

interface SquareInvoice {
  id: string
  version: number
  status: string
  invoice_number?: string
  public_url?: string
  payment_requests?: { total_completed_amount_money?: { amount: number } }[]
}

async function ensureSquareCustomer(
  creds: SquareCredentials,
  contactId: string
): Promise<string> {
  const existing = await getSquareCustomerId(contactId)
  if (existing) return existing

  const contact = await getContact(contactId)
  if (!contact) throw new Error('Contact not found')

  const { customer } = await squareRequest<{ customer: SquareCustomer }>(
    creds,
    'POST',
    '/v2/customers',
    {
      given_name: contact.name,
      email_address: contact.email ?? undefined,
      phone_number: contact.phone ?? undefined
    }
  )
  await setSquareCustomerId(contactId, customer.id)
  return customer.id
}

async function createOrder(
  creds: SquareCredentials,
  customerId: string,
  input: CreateInvoiceInput
): Promise<{ orderId: string; subtotalCents: number; totalCents: number }> {
  const lineItems = input.lineItems.map((item) => ({
    name: item.description,
    quantity: String(item.quantity),
    base_price_money: { amount: item.unitPriceCents, currency: 'USD' }
  }))
  const subtotalCents = input.lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0
  )

  const taxes =
    input.taxPercent > 0
      ? [
          {
            uid: 'tax',
            name: 'Tax',
            percentage: String(input.taxPercent),
            scope: 'ORDER',
            type: 'ADDITIVE'
          }
        ]
      : undefined

  const serviceCharges =
    input.shippingCents > 0
      ? [
          {
            uid: 'shipping',
            name: 'Shipping',
            amount_money: { amount: input.shippingCents, currency: 'USD' },
            calculation_phase: 'TOTAL_PHASE',
            taxable: false
          }
        ]
      : undefined

  const { order } = await squareRequest<{ order: SquareOrder }>(creds, 'POST', '/v2/orders', {
    idempotency_key: randomUUID(),
    order: {
      location_id: creds.locationId,
      customer_id: customerId,
      line_items: lineItems,
      taxes,
      service_charges: serviceCharges
    }
  })

  const totalCents =
    order.total_money?.amount ??
    Math.round(subtotalCents * (1 + input.taxPercent / 100)) + input.shippingCents

  return { orderId: order.id, subtotalCents, totalCents }
}

async function createSquareInvoice(
  creds: SquareCredentials,
  customerId: string,
  orderId: string,
  title: string,
  dueDate: string
): Promise<SquareInvoice> {
  const { invoice } = await squareRequest<{ invoice: SquareInvoice }>(
    creds,
    'POST',
    '/v2/invoices',
    {
      idempotency_key: randomUUID(),
      invoice: {
        location_id: creds.locationId,
        order_id: orderId,
        primary_recipient: { customer_id: customerId },
        title,
        delivery_method: 'EMAIL',
        payment_requests: [{ request_type: 'BALANCE', due_date: dueDate }],
        accepted_payment_methods: {
          card: true,
          square_gift_card: false,
          bank_account: false,
          buy_now_pay_later: false,
          cash_app_pay: false
        }
      }
    }
  )
  return invoice
}

async function publishInvoice(
  creds: SquareCredentials,
  invoiceId: string,
  version: number
): Promise<SquareInvoice> {
  const { invoice } = await squareRequest<{ invoice: SquareInvoice }>(
    creds,
    'POST',
    `/v2/invoices/${invoiceId}/publish`,
    { idempotency_key: randomUUID(), version }
  )
  return invoice
}

/**
 * Creates the customer/order/invoice in Square, applies tax, and publishes it —
 * the client is emailed immediately via Square.
 */
export async function createAndSendInvoice(
  input: CreateInvoiceInput
): Promise<InvoiceWithLineItems> {
  const creds = await loadSquareCredentials()
  if (!creds) {
    throw new Error('Square is not connected yet. Add your access token in Settings.')
  }
  if (!creds.locationId) {
    throw new Error('No Square location selected. Pick one in Settings.')
  }
  if (input.lineItems.length === 0) {
    throw new Error('Add at least one line item.')
  }

  const customerId = await ensureSquareCustomer(creds, input.contactId)
  const { orderId, subtotalCents, totalCents } = await createOrder(creds, customerId, input)
  let squareInvoice = await createSquareInvoice(
    creds,
    customerId,
    orderId,
    input.title,
    input.dueDate
  )

  let publishError: string | null = null
  if (!input.draft) {
    try {
      squareInvoice = await publishInvoice(creds, squareInvoice.id, squareInvoice.version)
    } catch (err) {
      publishError = err instanceof Error ? err.message : String(err)
    }
  }

  const record = await createInvoiceRecord({
    contactId: input.contactId,
    squareInvoiceId: squareInvoice.id,
    squareOrderId: orderId,
    title: input.title,
    dueDate: input.dueDate,
    subtotalCents,
    taxPercent: input.taxPercent,
    shippingCents: input.shippingCents,
    totalCents,
    status: squareInvoice.status as InvoiceStatus,
    invoiceNumber: squareInvoice.invoice_number ?? null,
    publicUrl: squareInvoice.public_url ?? null,
    lineItems: input.lineItems
  })

  await createActivity({
    contactId: input.contactId,
    type: 'invoice',
    subject: input.draft
      ? `Invoice drafted — ${input.title}`
      : publishError
        ? `Invoice created (not sent) — ${input.title}`
        : `Invoice sent — ${input.title}`,
    body: input.draft
      ? `Draft invoice for $${(totalCents / 100).toFixed(2)} saved. Nothing has been sent to the client yet.`
      : publishError
        ? `Invoice for $${(totalCents / 100).toFixed(2)} was created in Square but could not be sent automatically (${publishError}). Finish sending it from the Square dashboard.`
        : `Invoice for $${(totalCents / 100).toFixed(2)} (including tax) was sent to the client via Square.`,
    direction: 'outbound'
  })

  if (publishError) {
    throw new Error(
      `Invoice was created in Square but sending failed: ${publishError}. It's saved as a draft — finish sending it from the Square dashboard.`
    )
  }

  return record
}

/**
 * Deletes a draft invoice everywhere, or cancels a published one in Square (canceled
 * invoices stay on the books — Square keeps them, so the local record does too).
 */
export async function deleteOrCancelInvoice(
  localInvoiceId: string
): Promise<{ deleted: boolean }> {
  const local = await getInvoice(localInvoiceId)
  if (!local) throw new Error('Invoice not found')

  if (!local.squareInvoiceId) {
    await deleteInvoiceRecord(local.id)
    return { deleted: true }
  }

  const creds = await loadSquareCredentials()
  if (!creds) {
    throw new Error('Square is not connected yet. Add your access token in Settings.')
  }

  let current: SquareInvoice
  try {
    const res = await squareRequest<{ invoice: SquareInvoice }>(
      creds,
      'GET',
      `/v2/invoices/${local.squareInvoiceId}`
    )
    current = res.invoice
  } catch (err) {
    if (err instanceof SquareApiError && err.status === 404) {
      // Already gone in Square (deleted from the dashboard) — just drop the local record.
      await deleteInvoiceRecord(local.id)
      return { deleted: true }
    }
    throw err
  }

  if (current.status === 'DRAFT') {
    await squareRequest(creds, 'DELETE', `/v2/invoices/${current.id}?version=${current.version}`)
    await deleteInvoiceRecord(local.id)
    await createActivity({
      contactId: local.contactId,
      type: 'invoice',
      subject: `Invoice deleted — ${local.title}`,
      body: `Draft invoice for $${(local.totalCents / 100).toFixed(2)} was deleted.`,
      direction: null
    })
    return { deleted: true }
  }

  if (['PAID', 'REFUNDED', 'CANCELED', 'FAILED'].includes(current.status)) {
    throw new Error(
      `This invoice is ${current.status.toLowerCase().replace(/_/g, ' ')} and can no longer be canceled or deleted.`
    )
  }

  const { invoice: canceled } = await squareRequest<{ invoice: SquareInvoice }>(
    creds,
    'POST',
    `/v2/invoices/${current.id}/cancel`,
    { version: current.version }
  )
  await updateInvoiceStatus(
    local.id,
    canceled.status as InvoiceStatus,
    canceled.invoice_number ?? null,
    canceled.public_url ?? null,
    sumInvoicePaidCents(canceled.payment_requests),
    local.refundedCents
  )
  await createActivity({
    contactId: local.contactId,
    type: 'invoice',
    subject: `Invoice canceled — ${local.title}`,
    body: `Invoice for $${(local.totalCents / 100).toFixed(2)} was canceled in Square. The client can no longer pay it.`,
    direction: null
  })
  return { deleted: false }
}

/** Publishes a previously saved DRAFT invoice — Square emails it to the client immediately. */
export async function sendDraftInvoice(localInvoiceId: string): Promise<InvoiceWithLineItems | null> {
  const creds = await loadSquareCredentials()
  if (!creds) {
    throw new Error('Square is not connected yet. Add your access token in Settings.')
  }

  const local = await getInvoice(localInvoiceId)
  if (!local) throw new Error('Invoice not found')
  if (!local.squareInvoiceId) {
    throw new Error('This invoice has no Square record, so it cannot be sent from here.')
  }
  if (local.status !== 'DRAFT') {
    throw new Error('Only draft invoices can be sent.')
  }

  const { invoice: current } = await squareRequest<{ invoice: SquareInvoice }>(
    creds,
    'GET',
    `/v2/invoices/${local.squareInvoiceId}`
  )
  const published = await publishInvoice(creds, current.id, current.version)

  await updateInvoiceStatus(
    local.id,
    published.status as InvoiceStatus,
    published.invoice_number ?? null,
    published.public_url ?? null,
    sumInvoicePaidCents(published.payment_requests),
    local.refundedCents
  )

  await createActivity({
    contactId: local.contactId,
    type: 'invoice',
    subject: `Invoice sent — ${local.title}`,
    body: `Invoice for $${(local.totalCents / 100).toFixed(2)} was sent to the client via Square.`,
    direction: 'outbound'
  })

  return getInvoice(local.id)
}

export async function refreshInvoice(localInvoiceId: string): Promise<void> {
  const creds = await loadSquareCredentials()
  if (!creds) return

  const local = await getInvoice(localInvoiceId)
  if (!local?.squareInvoiceId) return

  const { invoice } = await squareRequest<{ invoice: SquareInvoice }>(
    creds,
    'GET',
    `/v2/invoices/${local.squareInvoiceId}`
  )

  const order = local.squareOrderId ? await getSquareOrder(creds, local.squareOrderId) : null

  await updateInvoiceStatus(
    local.id,
    invoice.status as InvoiceStatus,
    invoice.invoice_number ?? null,
    invoice.public_url ?? null,
    sumInvoicePaidCents(invoice.payment_requests),
    sumOrderRefundCents(order?.refunds)
  )
}
