import { getEstimate, sendEstimate, linkEstimateInvoice } from '../db/estimates'
import { getContact } from '../db/contacts'
import { getSetting, setSetting } from '../db/settings'
import { createActivity } from '../db/activities'
import { sendMail } from '../email/smtp'
import { listEmailAccounts, loadEmailAccountCredentials } from '../db/emailAccounts'
import { createAndSendInvoice } from '../square/invoices'
import type { EstimateWithItems, InvoiceWithLineItems } from '../../shared/types'

const PORTAL_URL_KEY = 'portal_base_url'

export async function getPortalUrl(): Promise<string | null> {
  return getSetting(PORTAL_URL_KEY)
}

export async function savePortalUrl(url: string): Promise<void> {
  await setSetting(PORTAL_URL_KEY, url)
}

function formatEstimateEmail(estimate: EstimateWithItems, signUrl: string): string {
  const lines = estimate.items.map(
    (item) =>
      `  ${item.description} — ${item.quantity} x $${(item.unitPriceCents / 100).toFixed(2)} = $${((item.quantity * item.unitPriceCents) / 100).toFixed(2)}`
  )
  const subtotalCents = estimate.items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0
  )
  const totalCents = Math.round(subtotalCents * (1 + estimate.taxPercent / 100))

  return [
    `Here's your estimate: ${estimate.title}`,
    '',
    ...lines,
    '',
    `Subtotal: $${(subtotalCents / 100).toFixed(2)}`,
    estimate.taxPercent > 0 ? `Tax (${estimate.taxPercent}%): included` : '',
    `Total: $${(totalCents / 100).toFixed(2)}`,
    '',
    `Please review and sign here: ${signUrl}`
  ]
    .filter(Boolean)
    .join('\n')
}

export async function sendEstimateForSignature(
  estimateId: string
): Promise<{ estimate: EstimateWithItems; signUrl: string }> {
  const portalUrl = await getPortalUrl()
  if (!portalUrl) {
    throw new Error('Set up the estimate signing page URL in Settings first.')
  }

  const sent = await sendEstimate(estimateId)
  if (!sent || !sent.signToken) throw new Error('Estimate not found')

  const estimate = await getEstimate(estimateId)
  if (!estimate) throw new Error('Estimate not found')

  const contact = await getContact(estimate.contactId)
  if (!contact?.email) {
    throw new Error("This contact doesn't have an email address on file.")
  }

  const signUrl = `${portalUrl.replace(/\/$/, '')}/e/${sent.signToken}`

  const [firstAccount] = await listEmailAccounts()
  if (!firstAccount) {
    throw new Error('Add an email account in Settings first.')
  }
  const account = await loadEmailAccountCredentials(firstAccount.id)
  if (!account) throw new Error('Add an email account in Settings first.')

  await sendMail({
    account: {
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure,
      user: account.user,
      password: account.password
    },
    to: contact.email,
    subject: `Estimate: ${estimate.title}`,
    text: formatEstimateEmail(estimate, signUrl)
  })

  await createActivity({
    contactId: estimate.contactId,
    type: 'email',
    subject: `Estimate sent — ${estimate.title}`,
    body: `Sent for signature: ${signUrl}`,
    direction: 'outbound',
    emailAccountId: account.id
  })

  return { estimate, signUrl }
}

export async function convertEstimateToInvoice(
  estimateId: string,
  dueDate: string
): Promise<InvoiceWithLineItems> {
  const estimate = await getEstimate(estimateId)
  if (!estimate) throw new Error('Estimate not found')
  if (estimate.status !== 'signed') throw new Error('Estimate must be signed before invoicing')

  const invoice = await createAndSendInvoice({
    contactId: estimate.contactId,
    title: estimate.title,
    dueDate,
    taxPercent: estimate.taxPercent,
    lineItems: estimate.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents
    }))
  })

  await linkEstimateInvoice(estimateId, invoice.id)

  return invoice
}
