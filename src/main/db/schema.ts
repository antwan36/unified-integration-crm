export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'New',
  address TEXT,
  notes TEXT,
  unmatched BOOLEAN NOT NULL DEFAULT FALSE,
  "squareCustomerId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "jobType" TEXT;

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  direction TEXT,
  "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta TEXT,
  "messageId" TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities("contactId");
CREATE INDEX IF NOT EXISTS idx_activities_occurredAt ON activities("occurredAt");

ALTER TABLE activities ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_activities_type_read ON activities(type, read);

CREATE TABLE IF NOT EXISTS email_accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  secure BOOLEAN NOT NULL,
  "user" TEXT NOT NULL,
  "encryptedPassword" TEXT NOT NULL,
  "smtpHost" TEXT NOT NULL,
  "smtpPort" INTEGER NOT NULL,
  "smtpSecure" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS "emailAccountId" TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_emailAccountId ON activities("emailAccountId");

CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL UNIQUE,
  "lastSeenUid" INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  "squareInvoiceId" TEXT UNIQUE,
  "squareOrderId" TEXT,
  title TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  "invoiceNumber" TEXT,
  "publicUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "totalCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "refundedCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices("contactId");
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "unitPriceCents" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items("invoiceId");

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  "encryptedValue" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "dueDate" TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks("contactId");
CREATE INDEX IF NOT EXISTS idx_tasks_done_due ON tasks(done, "dueDate");

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_startAt ON tasks("startAt");

CREATE INDEX IF NOT EXISTS idx_contacts_squareCustomerId ON contacts("squareCustomerId");

CREATE TABLE IF NOT EXISTS estimates (
  id TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "signToken" TEXT UNIQUE,
  "signerName" TEXT,
  "signedAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "invoiceId" TEXT REFERENCES invoices(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_contact ON estimates("contactId");
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_signToken ON estimates("signToken");

CREATE TABLE IF NOT EXISTS estimate_items (
  id TEXT PRIMARY KEY,
  "estimateId" TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items("estimateId");

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  data BYTEA NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_contact ON attachments("contactId");

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "unitPriceCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);
`
