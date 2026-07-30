import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { listEmailAccounts, loadEmailAccountCredentials } from '../db/emailAccounts'
import type { EmailAccountCredentials } from '../db/emailAccounts'
import { getSyncState, updateSyncState } from '../db/syncState'
import { findContactByEmail, createContact } from '../db/contacts'
import { createActivity, messageIdExists } from '../db/activities'
import { parseFormspreeBody, isFormspreeNotification } from './formspree'
import type { SyncResult } from '../../shared/types'

function addressOf(field: { value?: { address?: string; name?: string }[] } | undefined): {
  address: string | null
  name: string | null
} {
  const first = field?.value?.[0]
  return { address: first?.address ?? null, name: first?.name ?? null }
}

export async function runImapSyncAll(): Promise<SyncResult> {
  const accounts = await listEmailAccounts()
  if (accounts.length === 0) {
    return {
      ok: false,
      error: 'No email account configured yet. Add one in Settings.',
      fetched: 0,
      leadsCreated: 0,
      emailsLinked: 0,
      unmatched: 0,
      lastSyncedAt: null
    }
  }

  const results = await Promise.all(
    accounts.map(async (account) => {
      const creds = await loadEmailAccountCredentials(account.id)
      if (!creds) return null
      return runImapSyncForAccount(creds)
    })
  )

  const ok = results.every((r) => r?.ok !== false)
  const errors = results.filter((r) => r && !r.ok).map((r) => r!.error).filter(Boolean)
  const lastSyncedAt = results
    .map((r) => r?.lastSyncedAt ?? null)
    .filter((d): d is string => d !== null)
    .sort()
    .pop()

  return {
    ok,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    fetched: results.reduce((sum, r) => sum + (r?.fetched ?? 0), 0),
    leadsCreated: results.reduce((sum, r) => sum + (r?.leadsCreated ?? 0), 0),
    emailsLinked: results.reduce((sum, r) => sum + (r?.emailsLinked ?? 0), 0),
    unmatched: results.reduce((sum, r) => sum + (r?.unmatched ?? 0), 0),
    lastSyncedAt: lastSyncedAt ?? null
  }
}

async function runImapSyncForAccount(creds: EmailAccountCredentials): Promise<SyncResult> {
  const state = await getSyncState(creds.id)
  let leadsCreated = 0
  let emailsLinked = 0
  let unmatched = 0
  let fetched = 0
  let maxUid = state.lastSeenUid

  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.password },
    logger: false
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const range = state.lastSeenUid > 0 ? `${state.lastSeenUid + 1}:*` : '1:*'

      for await (const message of client.fetch(range, { source: true, uid: true }, { uid: true })) {
        if (!message.uid || message.uid <= state.lastSeenUid) continue
        if (!message.source) continue

        fetched++
        if (message.uid > maxUid) maxUid = message.uid

        const parsed = await simpleParser(message.source)
        const messageId = parsed.messageId ?? `${creds.id}-uid-${message.uid}`
        if (await messageIdExists(messageId)) continue

        const from = addressOf(parsed.from as never)
        const fromAddress = from.address ?? ''
        const subject = parsed.subject ?? '(no subject)'
        const text = parsed.text ?? ''
        const occurredAt = (parsed.date ?? new Date()).toISOString()

        if (isFormspreeNotification(fromAddress)) {
          const lead = parseFormspreeBody(text)
          if (lead && lead.email) {
            let contact = await findContactByEmail(lead.email)
            if (!contact) {
              contact = await createContact({
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                address: lead.address,
                source: 'website_form',
                status: 'New'
              })
              leadsCreated++
            }
            await createActivity({
              contactId: contact.id,
              type: 'form_submission',
              subject: 'Website contact form submission',
              body: lead.message ?? text,
              direction: 'inbound',
              occurredAt,
              messageId
            })
            continue
          }
        }

        if (!fromAddress) continue

        // Only Formspree submissions create new leads. Mail from senders who
        // aren't already a contact is otherwise skipped entirely — inbound
        // email should link to existing contacts, not mint new ones from
        // whoever happens to email the inbox.
        const contact = await findContactByEmail(fromAddress)
        if (!contact) continue
        emailsLinked++

        await createActivity({
          contactId: contact.id,
          type: 'email',
          subject,
          body: text,
          direction: 'inbound',
          occurredAt,
          messageId,
          read: false,
          emailAccountId: creds.id
        })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => client.close())
  }

  await updateSyncState(creds.id, maxUid)
  const newState = await getSyncState(creds.id)

  return {
    ok: true,
    fetched,
    leadsCreated,
    emailsLinked,
    unmatched,
    lastSyncedAt: newState.lastSyncedAt
  }
}
