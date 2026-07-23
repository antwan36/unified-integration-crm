import type { SquareCredentials, SquareLocation } from '../../shared/types'

// Square's REST API is date-versioned. Bump this if Square's changelog introduces a
// breaking change to endpoints used here (https://developer.squareup.com/docs/build-basics/api-versioning).
const SQUARE_VERSION = '2025-01-23'

export class SquareApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'SquareApiError'
  }
}

function baseUrl(environment: SquareCredentials['environment']): string {
  return environment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

export async function squareRequest<T>(
  creds: Pick<SquareCredentials, 'accessToken' | 'environment'>,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${baseUrl(creds.environment)}${path}`, {
      method,
      headers: {
        'Square-Version': SQUARE_VERSION,
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch (err) {
    throw new SquareApiError(
      `Could not reach Square (${err instanceof Error ? err.message : String(err)})`,
      0
    )
  }

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    interface SquareErrorBody {
      errors?: { detail?: string; code?: string }[]
    }
    const body = json as SquareErrorBody | null
    const message = body?.errors?.[0]?.detail ?? body?.errors?.[0]?.code ?? `Square API error (${res.status})`
    throw new SquareApiError(message, res.status, json)
  }
  return json as T
}

interface ListLocationsResponse {
  locations?: { id: string; name?: string; status?: string }[]
}

export async function listSquareLocations(
  creds: Pick<SquareCredentials, 'accessToken' | 'environment'>
): Promise<SquareLocation[]> {
  const data = await squareRequest<ListLocationsResponse>(creds, 'GET', '/v2/locations')
  return (data.locations ?? [])
    .filter((loc) => loc.status !== 'INACTIVE')
    .map((loc) => ({ id: loc.id, name: loc.name ?? loc.id }))
}

export interface SquareCustomer {
  id: string
  given_name?: string
  family_name?: string
  company_name?: string
  email_address?: string
  phone_number?: string
}

interface ListCustomersResponse {
  customers?: SquareCustomer[]
  cursor?: string
}

export async function listAllSquareCustomers(
  creds: Pick<SquareCredentials, 'accessToken' | 'environment'>
): Promise<SquareCustomer[]> {
  const customers: SquareCustomer[] = []
  let cursor: string | undefined
  do {
    const path = cursor ? `/v2/customers?cursor=${encodeURIComponent(cursor)}` : '/v2/customers'
    const data = await squareRequest<ListCustomersResponse>(creds, 'GET', path)
    customers.push(...(data.customers ?? []))
    cursor = data.cursor
  } while (cursor)
  return customers
}

export interface SquareInvoiceSummary {
  id: string
  version: number
  status: string
  title?: string
  invoice_number?: string
  public_url?: string
  order_id?: string
  primary_recipient?: { customer_id?: string }
  payment_requests?: { due_date?: string; total_completed_amount_money?: { amount: number } }[]
}

export function sumInvoicePaidCents(paymentRequests: SquareInvoiceSummary['payment_requests']): number {
  return (paymentRequests ?? []).reduce(
    (sum, req) => sum + (req.total_completed_amount_money?.amount ?? 0),
    0
  )
}

interface ListInvoicesResponse {
  invoices?: SquareInvoiceSummary[]
  cursor?: string
}

export async function listAllSquareInvoices(
  creds: SquareCredentials
): Promise<SquareInvoiceSummary[]> {
  const invoices: SquareInvoiceSummary[] = []
  let cursor: string | undefined
  do {
    const params = new URLSearchParams({ location_id: creds.locationId })
    if (cursor) params.set('cursor', cursor)
    const data = await squareRequest<ListInvoicesResponse>(
      creds,
      'GET',
      `/v2/invoices?${params.toString()}`
    )
    invoices.push(...(data.invoices ?? []))
    cursor = data.cursor
  } while (cursor)
  return invoices
}

export interface SquareOrderLineItem {
  name?: string
  quantity: string
  base_price_money?: { amount: number }
}

export interface SquareOrderRefund {
  amount_money?: { amount: number }
  status?: string
}

export interface SquareOrderDetail {
  id: string
  total_money?: { amount: number }
  line_items?: SquareOrderLineItem[]
  refunds?: SquareOrderRefund[]
}

export function sumOrderRefundCents(refunds: SquareOrderRefund[] | undefined): number {
  return (refunds ?? [])
    .filter((r) => r.status !== 'REJECTED' && r.status !== 'FAILED')
    .reduce((sum, r) => sum + (r.amount_money?.amount ?? 0), 0)
}

export async function getSquareOrder(
  creds: Pick<SquareCredentials, 'accessToken' | 'environment'>,
  orderId: string
): Promise<SquareOrderDetail | null> {
  const data = await squareRequest<{ order?: SquareOrderDetail }>(
    creds,
    'GET',
    `/v2/orders/${orderId}`
  )
  return data.order ?? null
}
