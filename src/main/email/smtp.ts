import nodemailer from 'nodemailer'

export interface SmtpAccount {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  user: string
  password: string
}

export interface SendMailInput {
  account: SmtpAccount
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string | null
  references?: string | null
}

export interface SentMail {
  messageId: string
}

export async function testSmtpConnection(
  account: SmtpAccount
): Promise<{ ok: boolean; error?: string }> {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: { user: account.user, pass: account.password }
  })
  try {
    await transporter.verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function sendMail(input: SendMailInput): Promise<SentMail> {
  const { account } = input
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: { user: account.user, pass: account.password }
  })

  const info = await transporter.sendMail({
    from: { name: 'Unified Integration', address: account.user },
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined
  })

  return { messageId: info.messageId }
}
