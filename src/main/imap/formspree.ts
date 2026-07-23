export interface ParsedLead {
  name: string
  email: string | null
  phone: string | null
  address: string | null
  message: string | null
}

const FIELD_LINE = /^\s*([a-z][a-z _-]{1,30})\s*[:]\s*(.+)$/i

const CORE_FIELDS = new Set(['name', 'full name', 'email', 'e-mail', 'phone', 'phone number', 'address'])

/**
 * Formspree's plain-text notification body is a flat list of "Field: value" lines
 * matching whatever fields the visitor's form had (name, email, phone, address, budget,
 * project_type, notes, description, ...). There's no fixed schema, so we pull out the
 * few fields we model directly on Contact and fold everything else into the message body
 * as context, rather than assuming a fixed set of field names.
 */
export function parseFormspreeBody(text: string): ParsedLead | null {
  const lines = text.split(/\r?\n/)
  let name: string | null = null
  let email: string | null = null
  let phone: string | null = null
  let address: string | null = null
  const contextLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const match = line.match(FIELD_LINE)
    if (!match) continue

    const label = match[1].trim().toLowerCase()
    const value = match[2].trim()
    if (!value) continue

    if (label === 'name' || label === 'full name') name = value
    else if (label === 'email' || label === 'e-mail') email = value
    else if (label === 'phone' || label === 'phone number') phone = value
    else if (label === 'address') address = value
    else if (!CORE_FIELDS.has(label)) {
      const niceLabel = label.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
      contextLines.push(/^(message|details|notes|description)$/i.test(label) ? value : `${niceLabel}: ${value}`)
    }
  }

  if (!name && !email) return null

  return {
    name: name ?? email ?? 'Unknown lead',
    email,
    phone,
    address,
    message: contextLines.length ? contextLines.join('\n') : null
  }
}

export function isFormspreeNotification(fromAddress: string): boolean {
  return /formspree\.io|noreply@formspree/i.test(fromAddress)
}
