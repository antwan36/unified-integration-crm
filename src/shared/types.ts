export type ContactStatus = 'New' | 'Contacted' | 'Quoted' | 'Won' | 'Lost'

export const CONTACT_STATUSES: ContactStatus[] = ['New', 'Contacted', 'Quoted', 'Won', 'Lost']

export const JOB_TYPES = ['Residential', 'Commercial', 'Referral Partner', 'Other'] as const
export type JobType = (typeof JOB_TYPES)[number]

export interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string
  status: ContactStatus
  address: string | null
  notes: string | null
  unmatched: boolean
  jobType: string | null
  createdAt: string
  updatedAt: string
}

export type ActivityType = 'note' | 'email' | 'form_submission' | 'status_change' | 'task' | 'invoice'
export type ActivityDirection = 'inbound' | 'outbound' | null

export interface Activity {
  id: string
  contactId: string
  type: ActivityType
  subject: string | null
  body: string | null
  direction: ActivityDirection
  occurredAt: string
  meta: string | null
  messageId: string | null
  read: boolean
  emailAccountId: string | null
  createdAt: string
}

export interface EmailActivity extends Activity {
  contactName: string
  contactEmail: string | null
  emailAccountLabel: string | null
}

export interface ListEmailsFilter {
  search?: string
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

export interface EmailListResult {
  items: EmailActivity[]
  total: number
}

export interface ContactWithActivities extends Contact {
  activities: Activity[]
}

export interface DashboardStats {
  statusCounts: Record<ContactStatus, number>
  totalContacts: number
  unmatchedCount: number
  recentContacts: Contact[]
  recentActivities: (Activity & { contactName: string })[]
  staleLeads: Contact[]
}

export interface ImapCredentials {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  mailbox: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
}

export interface EmailAccount {
  id: string
  label: string
  host: string
  port: number
  secure: boolean
  user: string
  hasPassword: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  createdAt: string
}

export interface CreateEmailAccountInput {
  label: string
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
}

export interface UpdateEmailAccountInput {
  label?: string
  host?: string
  port?: number
  secure?: boolean
  user?: string
  password?: string
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
}

export interface TestEmailAccountInput {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
}

export interface SendEmailInput {
  contactId: string
  emailAccountId: string
  to: string
  subject: string
  body: string
  inReplyTo?: string | null
  references?: string | null
}

export interface ListContactsFilter {
  search?: string
  status?: ContactStatus
  jobType?: string
}

export interface CreateContactInput {
  name: string
  email?: string | null
  phone?: string | null
  source?: string
  status?: ContactStatus
  address?: string | null
  notes?: string | null
  unmatched?: boolean
  jobType?: string | null
}

export interface UpdateContactInput {
  name?: string
  email?: string | null
  phone?: string | null
  status?: ContactStatus
  address?: string | null
  notes?: string | null
  unmatched?: boolean
  jobType?: string | null
}

export interface SyncResult {
  ok: boolean
  error?: string
  fetched: number
  leadsCreated: number
  emailsLinked: number
  unmatched: number
  lastSyncedAt: string | null
}

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}

export interface CreateTeamMemberInput {
  email: string
  password: string
  name: string
}

export interface Attachment {
  id: string
  contactId: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface UploadAttachmentInput {
  contactId: string
  filename: string
  mimeType: string
  data: ArrayBuffer
}

export interface AttachmentData {
  filename: string
  mimeType: string
  data: ArrayBuffer
}

export type InvoiceStatus =
  | 'DRAFT'
  | 'UNPAID'
  | 'SCHEDULED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'CANCELED'
  | 'FAILED'
  | 'PAYMENT_PENDING'

export interface InvoiceLineItem {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unitPriceCents: number
}

export interface Invoice {
  id: string
  contactId: string
  squareInvoiceId: string | null
  squareOrderId: string | null
  title: string
  dueDate: string
  subtotalCents: number
  taxPercent: number
  totalCents: number
  paidCents: number
  refundedCents: number
  status: InvoiceStatus
  invoiceNumber: string | null
  publicUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceWithLineItems extends Invoice {
  lineItems: InvoiceLineItem[]
}

export interface InvoiceWithContactName extends Invoice {
  contactName: string
}

export interface InvoiceStats {
  outstandingCents: number
  outstandingCount: number
  paidCents: number
  paidCount: number
  overdueCents: number
  overdueCount: number
}

export interface InvoiceStatusBreakdown {
  status: InvoiceStatus
  count: number
  totalCents: number
}

export interface InvoiceMonthlyPoint {
  month: string
  invoicedCents: number
  count: number
}

export interface InvoiceAnalytics {
  totalInvoicedCents: number
  totalInvoicedCount: number
  totalCollectedCents: number
  averageInvoiceCents: number
  byStatus: InvoiceStatusBreakdown[]
  monthly: InvoiceMonthlyPoint[]
}

export interface SquareSyncResult {
  ok: boolean
  error?: string
  customersCreated: number
  customersLinked: number
  invoicesCreated: number
  invoicesUpdated: number
  invoicesPaid: number
}

export interface Task {
  id: string
  contactId: string
  title: string
  dueDate: string | null
  done: boolean
  completedAt: string | null
  createdAt: string
  startAt: string | null
  endAt: string | null
  location: string | null
}

export interface TaskWithContactName extends Task {
  contactName: string
}

export interface CreateTaskInput {
  contactId: string
  title: string
  dueDate?: string | null
  startAt?: string | null
  endAt?: string | null
  location?: string | null
}

export interface CreateInvoiceLineItemInput {
  description: string
  quantity: number
  unitPriceCents: number
}

export interface CreateInvoiceInput {
  contactId: string
  title: string
  dueDate: string
  taxPercent: number
  lineItems: CreateInvoiceLineItemInput[]
  draft?: boolean
}

export type SquareEnvironment = 'production' | 'sandbox'

export interface SquareCredentials {
  accessToken: string
  environment: SquareEnvironment
  locationId: string
}

export interface SquareSettings {
  environment: SquareEnvironment
  locationId: string
  locationName: string | null
  hasToken: boolean
}

export interface SquareLocation {
  id: string
  name: string
}

export interface SquareTestResult {
  ok: boolean
  error?: string
  locations?: SquareLocation[]
}

export type EstimateStatus = 'draft' | 'sent' | 'signed' | 'invoiced'

export interface EstimateItem {
  id: string
  estimateId: string
  description: string
  quantity: number
  unitPriceCents: number
}

export interface Estimate {
  id: string
  contactId: string
  title: string
  status: EstimateStatus
  taxPercent: number
  signToken: string | null
  signerName: string | null
  signedAt: string | null
  sentAt: string | null
  invoiceId: string | null
  createdAt: string
  updatedAt: string
}

export interface EstimateWithItems extends Estimate {
  items: EstimateItem[]
}

export interface EstimateWithContactName extends Estimate {
  contactName: string
  totalCents: number
}

export interface CatalogItem {
  id: string
  name: string
  description: string | null
  unitPriceCents: number
  createdAt: string
  updatedAt: string
}

export interface CreateCatalogItemInput {
  name: string
  description?: string | null
  unitPriceCents: number
}

export interface ScrapedProduct {
  name: string | null
  description: string | null
  priceCents: number | null
}

export interface ScrapeProductResult {
  ok: boolean
  error?: string
  product?: ScrapedProduct
}

export interface UpdateCatalogItemInput {
  name: string
  description?: string | null
  unitPriceCents: number
}

export interface CreateEstimateItemInput {
  description: string
  quantity: number
  unitPriceCents: number
}

export interface CreateEstimateInput {
  contactId: string
  title: string
  taxPercent: number
  items: CreateEstimateItemInput[]
}

export interface UpdateEstimateInput {
  title: string
  taxPercent: number
  items: CreateEstimateItemInput[]
}

export interface UpdateCheckResult {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string | null
  downloadUrl: string | null
  releaseNotes: string | null
}
