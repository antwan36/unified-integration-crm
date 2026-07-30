import { getReviewRequest, markReviewRequestSent, dismissReviewRequest } from '../db/reviewRequests'
import { getSetting, setSetting } from '../db/settings'
import { createActivity } from '../db/activities'
import { sendMail } from '../email/smtp'
import { listEmailAccounts, loadEmailAccountCredentials } from '../db/emailAccounts'
import type { ReviewRequestWithDetails } from '../../shared/types'

const GOOGLE_REVIEW_LINK_KEY = 'google_review_link'

export async function getGoogleReviewLink(): Promise<string | null> {
  return getSetting(GOOGLE_REVIEW_LINK_KEY)
}

export async function saveGoogleReviewLink(url: string): Promise<void> {
  await setSetting(GOOGLE_REVIEW_LINK_KEY, url)
}

function formatReviewEmailText(contactName: string, reviewLink: string): string {
  const firstName = contactName.split(' ')[0] || contactName
  return `Hi ${firstName},

Thanks again for choosing Unified Integration. If everything's working the way it should, we'd really appreciate a quick review — it's one of the biggest ways a small local shop like ours gets found by the next person searching for a smart home or AV installer in the area.

Leave a review here: ${reviewLink}

If anything about the install isn't quite right, just reply to this email instead and we'll get it sorted first.

Thanks,
Unified Integration
(717) 322-2180`
}

function formatReviewEmailHtml(contactName: string, reviewLink: string): string {
  const firstName = contactName.split(' ')[0] || contactName
  return `<div style="font-family: -apple-system, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 480px;">
  <p>Hi ${firstName},</p>
  <p>Thanks again for choosing Unified Integration. If everything's working the way it should, we'd really appreciate a quick review — it's one of the biggest ways a small local shop like ours gets found by the next person searching for a smart home or AV installer in the area.</p>
  <p><a href="${reviewLink}" style="display: inline-block; background: #d97736; color: #000; font-weight: 600; padding: 10px 18px; border-radius: 4px; text-decoration: none;">Leave a review</a></p>
  <p>If anything about the install isn't quite right, just reply to this email instead and we'll get it sorted first.</p>
  <p>Thanks,<br>Unified Integration<br>(717) 322-2180</p>
</div>`
}

export async function sendReviewRequest(id: string): Promise<ReviewRequestWithDetails> {
  const reviewRequest = await getReviewRequest(id)
  if (!reviewRequest) throw new Error('Review request not found')
  if (reviewRequest.status !== 'queued') throw new Error('This review request was already sent or dismissed.')
  if (!reviewRequest.contactEmail) {
    throw new Error("This contact doesn't have an email address on file.")
  }

  const reviewLink = await getGoogleReviewLink()
  if (!reviewLink) {
    throw new Error('Set up the Google review link in Settings first.')
  }

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
    to: reviewRequest.contactEmail,
    subject: 'How did everything turn out?',
    text: formatReviewEmailText(reviewRequest.contactName, reviewLink),
    html: formatReviewEmailHtml(reviewRequest.contactName, reviewLink)
  })

  await markReviewRequestSent(id)

  await createActivity({
    contactId: reviewRequest.contactId,
    type: 'email',
    subject: 'Review request sent',
    body: `Sent a Google review request for "${reviewRequest.invoiceTitle}": ${reviewLink}`,
    direction: 'outbound',
    emailAccountId: account.id
  })

  const updated = await getReviewRequest(id)
  if (!updated) throw new Error('Review request not found')
  return updated
}

export async function dismissReviewRequestAction(id: string): Promise<void> {
  const reviewRequest = await getReviewRequest(id)
  if (!reviewRequest) throw new Error('Review request not found')
  await dismissReviewRequest(id)
}
