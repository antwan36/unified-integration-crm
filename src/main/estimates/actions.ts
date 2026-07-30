import { getEstimate, ensureSignToken, markEstimateSent, linkEstimateInvoice } from '../db/estimates'
import { getContact } from '../db/contacts'
import { getSetting, setSetting } from '../db/settings'
import { createActivity } from '../db/activities'
import { sendMail } from '../email/smtp'
import { listEmailAccounts, loadEmailAccountCredentials } from '../db/emailAccounts'
import { createAndSendInvoice } from '../square/invoices'
import type { EstimateWithItems, InvoiceWithLineItems } from '../../shared/types'

const LOGO_DATA_URI =
  'data:image/png;base64,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'

const PORTAL_URL_KEY = 'portal_base_url'

export async function getPortalUrl(): Promise<string | null> {
  return getSetting(PORTAL_URL_KEY)
}

export async function savePortalUrl(url: string): Promise<void> {
  await setSetting(PORTAL_URL_KEY, url)
}

function computeEstimateTotals(estimate: EstimateWithItems): {
  subtotalCents: number
  taxCents: number
  totalCents: number
} {
  const subtotalCents = estimate.items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0
  )
  const taxCents = Math.round(subtotalCents * (estimate.taxPercent / 100))
  const totalCents = subtotalCents + taxCents + estimate.shippingCents
  return { subtotalCents, taxCents, totalCents }
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatEstimateEmailText(estimate: EstimateWithItems, signUrl: string): string {
  const { subtotalCents, taxCents, totalCents } = computeEstimateTotals(estimate)
  const lines = estimate.items.map(
    (item) =>
      `  ${item.description} — ${item.quantity} x ${money(item.unitPriceCents)} = ${money(Math.round(item.quantity * item.unitPriceCents))}`
  )

  return [
    `Here's your quote: ${estimate.title}`,
    '',
    ...lines,
    '',
    `Subtotal: ${money(subtotalCents)}`,
    estimate.taxPercent > 0 ? `Tax (${estimate.taxPercent}%): ${money(taxCents)}` : '',
    estimate.shippingCents > 0 ? `Shipping: ${money(estimate.shippingCents)}` : '',
    `Total: ${money(totalCents)}`,
    '',
    `Please review and sign here: ${signUrl}`
  ]
    .filter(Boolean)
    .join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatEstimateEmailHtml(
  estimate: EstimateWithItems,
  signUrl: string,
  contactName: string
): string {
  const { subtotalCents, taxCents, totalCents } = computeEstimateTotals(estimate)

  const rows = estimate.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#111827;font-size:14px;">${escapeHtml(item.description)}</td>
          <td align="center" style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#6b7280;font-size:14px;">${item.quantity}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#6b7280;font-size:14px;">${money(item.unitPriceCents)}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#111827;font-size:14px;">${money(Math.round(item.quantity * item.unitPriceCents))}</td>
        </tr>`
    )
    .join('')

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;border-bottom:3px solid #d97736;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:10px;"><img src="${LOGO_DATA_URI}" alt="Unified Integration" width="28" height="28" style="display:block;background-color:#f97316;border-radius:6px;padding:4px;box-sizing:border-box;"></td>
                <td><span style="font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.01em;">Unified Integration</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">Hi ${escapeHtml(contactName)},</p>
              <h1 style="margin:0 0 6px;font-size:20px;color:#111827;">${escapeHtml(estimate.title)}</h1>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Here's the quote for your project. Review the details below and sign when you're ready to move forward.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr>
                    <th align="left" style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;padding-bottom:8px;border-bottom:1px solid #e5e5e5;">Item</th>
                    <th align="center" style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;padding-bottom:8px;border-bottom:1px solid #e5e5e5;">Qty</th>
                    <th align="right" style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;padding-bottom:8px;border-bottom:1px solid #e5e5e5;">Price</th>
                    <th align="right" style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;padding-bottom:8px;border-bottom:1px solid #e5e5e5;">Total</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#6b7280;">Subtotal</td>
                  <td align="right" style="padding:4px 0;font-size:13px;color:#111827;">${money(subtotalCents)}</td>
                </tr>
                ${
                  estimate.taxPercent > 0
                    ? `<tr>
                  <td style="padding:4px 0;font-size:13px;color:#6b7280;">Tax (${estimate.taxPercent}%)</td>
                  <td align="right" style="padding:4px 0;font-size:13px;color:#111827;">${money(taxCents)}</td>
                </tr>`
                    : ''
                }
                ${
                  estimate.shippingCents > 0
                    ? `<tr>
                  <td style="padding:4px 0;font-size:13px;color:#6b7280;">Shipping</td>
                  <td align="right" style="padding:4px 0;font-size:13px;color:#111827;">${money(estimate.shippingCents)}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#111827;border-top:1px solid #e5e5e5;">Total</td>
                  <td align="right" style="padding:10px 0 0;font-size:15px;font-weight:700;color:#111827;border-top:1px solid #e5e5e5;">${money(totalCents)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;" align="center">
              <a href="${signUrl}" style="display:inline-block;background:#d97736;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;">Review &amp; Sign Quote</a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;" align="center">
              <p style="margin:0;font-size:11px;color:#9ca3af;word-break:break-all;">Or paste this link into your browser: <a href="${signUrl}" style="color:#9ca3af;">${signUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#fafafa;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Unified Integration · Lancaster County, PA · (717) 322-2180</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendEstimateForSignature(
  estimateId: string
): Promise<{ estimate: EstimateWithItems; signUrl: string }> {
  const portalUrl = await getPortalUrl()
  if (!portalUrl) {
    throw new Error('Set up the quote signing page URL in Settings first.')
  }

  const estimateBefore = await getEstimate(estimateId)
  if (!estimateBefore) throw new Error('Estimate not found')
  if (estimateBefore.status === 'signed' || estimateBefore.status === 'invoiced') {
    throw new Error(
      'This quote has already been signed by the client — resending would overwrite their signature. Refresh the page to see the current status.'
    )
  }

  const contact = await getContact(estimateBefore.contactId)
  if (!contact?.email) {
    throw new Error("This contact doesn't have an email address on file.")
  }

  const [firstAccount] = await listEmailAccounts()
  if (!firstAccount) {
    throw new Error('Add an email account in Settings first.')
  }
  const account = await loadEmailAccountCredentials(firstAccount.id)
  if (!account) throw new Error('Add an email account in Settings first.')

  // Token first (needed for the link in the email body), but status only flips
  // to 'sent' once the email actually goes out — otherwise a failed SMTP send
  // would leave the estimate showing "Sent" with nothing having been delivered.
  const signToken = await ensureSignToken(estimateId)
  if (!signToken) throw new Error('Estimate not found')
  const signUrl = `${portalUrl.replace(/\/$/, '')}/e/${signToken}`

  await sendMail({
    account: {
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure,
      user: account.user,
      password: account.password
    },
    to: contact.email,
    subject: `Quote: ${estimateBefore.title}`,
    text: formatEstimateEmailText(estimateBefore, signUrl),
    html: formatEstimateEmailHtml(estimateBefore, signUrl, contact.name)
  })

  const sent = await markEstimateSent(estimateId)
  if (!sent) throw new Error('Estimate not found')
  const estimate = await getEstimate(estimateId)
  if (!estimate) throw new Error('Estimate not found')

  await createActivity({
    contactId: estimate.contactId,
    type: 'email',
    subject: `Quote sent — ${estimate.title}`,
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
    shippingCents: estimate.shippingCents,
    lineItems: estimate.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      link: item.link
    }))
  })

  await linkEstimateInvoice(estimateId, invoice.id)

  return invoice
}
