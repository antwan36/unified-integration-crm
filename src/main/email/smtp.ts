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
  inReplyTo?: string | null
  references?: string | null
}

export interface SentMail {
  messageId: string
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
    from: account.user,
    to: input.to,
    subject: input.subject,
    text: input.text,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined
  })

  return { messageId: info.messageId }
}
