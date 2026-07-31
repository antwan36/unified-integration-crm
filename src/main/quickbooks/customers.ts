import { quickBooksQuery, quickBooksRequest } from './client'
import { getContact, getQuickBooksCustomerId, setQuickBooksCustomerId } from '../db/contacts'

interface QuickBooksCustomer {
  Id: string
}

interface CustomerQueryResponse {
  QueryResponse?: { Customer?: QuickBooksCustomer[] }
}

/** Escapes single quotes for QuickBooks' SQL-like query language. */
function qbEscape(value: string): string {
  return value.replace(/'/g, "\\'")
}

/**
 * Finds or creates the QuickBooks Customer for a CRM contact. Checks the local
 * quickbooksCustomerId link first, then falls back to a DisplayName lookup in
 * QuickBooks itself (covers contacts that already have a customer record there,
 * e.g. from a previous manual entry) before creating a new one.
 */
export async function ensureQuickBooksCustomer(realmId: string, contactId: string): Promise<string> {
  const existing = await getQuickBooksCustomerId(contactId)
  if (existing) return existing

  const contact = await getContact(contactId)
  if (!contact) throw new Error('Contact not found')

  const found = await quickBooksQuery<CustomerQueryResponse>(
    realmId,
    `SELECT Id FROM Customer WHERE DisplayName = '${qbEscape(contact.name)}'`
  )
  const matchedId = found.QueryResponse?.Customer?.[0]?.Id
  if (matchedId) {
    await setQuickBooksCustomerId(contactId, matchedId)
    return matchedId
  }

  const created = await quickBooksRequest<{ Customer: QuickBooksCustomer }>(
    'POST',
    `/v3/company/${realmId}/customer`,
    {
      DisplayName: contact.name,
      PrimaryEmailAddr: contact.email ? { Address: contact.email } : undefined,
      PrimaryPhone: contact.phone ? { FreeFormNumber: contact.phone } : undefined
    }
  )
  await setQuickBooksCustomerId(contactId, created.Customer.Id)
  return created.Customer.Id
}
