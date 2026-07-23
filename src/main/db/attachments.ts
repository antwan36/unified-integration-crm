import { getDb } from './index'
import { newId } from './ids'
import type { Attachment, UploadAttachmentInput } from '../../shared/types'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10MB

interface AttachmentRow {
  id: string
  contactId: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: Date
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    contactId: row.contactId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString()
  }
}

export async function listAttachmentsForContact(contactId: string): Promise<Attachment[]> {
  const result = await getDb().query<AttachmentRow>(
    `SELECT id, "contactId", filename, "mimeType", "sizeBytes", "createdAt"
     FROM attachments WHERE "contactId" = $1 ORDER BY "createdAt" DESC`,
    [contactId]
  )
  return result.rows.map(toAttachment)
}

export async function uploadAttachment(input: UploadAttachmentInput): Promise<Attachment> {
  const buffer = Buffer.from(input.data)
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${input.filename}" is too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB).`)
  }
  const id = newId()
  const result = await getDb().query<AttachmentRow>(
    `INSERT INTO attachments (id, "contactId", filename, "mimeType", "sizeBytes", data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, "contactId", filename, "mimeType", "sizeBytes", "createdAt"`,
    [id, input.contactId, input.filename, input.mimeType, buffer.byteLength, buffer]
  )
  return toAttachment(result.rows[0])
}

export async function getAttachmentData(
  id: string
): Promise<{ filename: string; mimeType: string; data: Buffer } | null> {
  const result = await getDb().query<{ filename: string; mimeType: string; data: Buffer }>(
    `SELECT filename, "mimeType", data FROM attachments WHERE id = $1`,
    [id]
  )
  return result.rows[0] ?? null
}

export async function deleteAttachment(id: string): Promise<void> {
  await getDb().query('DELETE FROM attachments WHERE id = $1', [id])
}
