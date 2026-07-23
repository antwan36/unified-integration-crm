import { squareRequest, SquareApiError, type SquareCustomer } from './client'
import { loadSquareCredentials } from '../secrets/square-credentials'
import { getContact, getSquareCustomerId } from '../db/contacts'

/**
 * Pushes name/email/phone changes to the linked Square customer, if any. No-op if the
 * contact was never linked to Square (creation stays lazy — a Square customer is only
 * created the first time an invoice is sent, in square/invoices.ts) or Square isn't
 * connected. Failures are logged, not thrown — a Square-side hiccup shouldn't block
 * saving the contact locally.
 */
export async function syncContactToSquare(contactId: string): Promise<void> {
  const creds = await loadSquareCredentials()
  if (!creds) return

  const squareCustomerId = await getSquareCustomerId(contactId)
  if (!squareCustomerId) return

  const contact = await getContact(contactId)
  if (!contact) return

  try {
    await squareRequest<{ customer: SquareCustomer }>(
      creds,
      'PUT',
      `/v2/customers/${squareCustomerId}`,
      {
        given_name: contact.name,
        email_address: contact.email ?? undefined,
        phone_number: contact.phone ?? undefined
      }
    )
  } catch (err) {
    console.error(`Failed to sync contact ${contactId} to Square:`, err)
  }
}

/**
 * Deletes the linked Square customer, if any, before the local contact record is
 * removed — call this while the contact row (and its squareCustomerId) still exists.
 * A 404 (already gone in Square) is treated as success, not an error.
 */
export async function deleteSquareCustomerIfLinked(contactId: string): Promise<void> {
  const creds = await loadSquareCredentials()
  if (!creds) return

  const squareCustomerId = await getSquareCustomerId(contactId)
  if (!squareCustomerId) return

  try {
    await squareRequest(creds, 'DELETE', `/v2/customers/${squareCustomerId}`)
  } catch (err) {
    if (err instanceof SquareApiError && err.status === 404) return
    console.error(`Failed to delete Square customer for contact ${contactId}:`, err)
  }
}
