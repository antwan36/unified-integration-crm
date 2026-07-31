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
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "quickbooksCustomerId" TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_quickbooksCustomerId ON contacts("quickbooksCustomerId");

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
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "shippingCents" INTEGER NOT NULL DEFAULT 0;
-- Internal-only: what the job actually cost you (materials, labor, etc.). Never
-- sent to Square, never shown to the client — purely for the Invoices tab's profit view.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "costCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "refundedCents" INTEGER NOT NULL DEFAULT 0;
-- Set once this invoice has been pushed into QuickBooks (live create, or the one-time
-- historical migration from Square) — makes the migration idempotent/resumable.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "quickbooksInvoiceId" TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices("contactId");
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "unitPriceCents" INTEGER NOT NULL
);

ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS "link" TEXT;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items("invoiceId");

-- Queued when a Square invoice transitions to PAID (see upsertInvoiceFromSquare).
-- One row per invoice (UNIQUE) so repeated syncs never double-queue the same job.
CREATE TABLE IF NOT EXISTS review_requests (
  id TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  "invoiceId" TEXT NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  "queuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sentAt" TIMESTAMPTZ,
  "dismissedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(status);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact ON review_requests("contactId");

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
  "shippingCents" INTEGER NOT NULL DEFAULT 0,
  "signToken" TEXT UNIQUE,
  "signerName" TEXT,
  "signedAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "invoiceId" TEXT REFERENCES invoices(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS "shippingCents" INTEGER NOT NULL DEFAULT 0;

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

ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS "link" TEXT;

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

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  category TEXT,
  "unitCostCents" INTEGER NOT NULL DEFAULT 0,
  "quantityOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reorderThreshold" DOUBLE PRECISION,
  location TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "quantityDelta" DOUBLE PRECISION NOT NULL,
  "unitCostCents" INTEGER,
  "contactId" TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  notes TEXT,
  date TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions("itemId");

CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  "encryptedTaxId" TEXT,
  "rateType" TEXT NOT NULL DEFAULT 'hourly',
  "defaultRateCents" INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payees_name ON payees(name);

CREATE TABLE IF NOT EXISTS payroll_payments (
  id TEXT PRIMARY KEY,
  "payeeId" TEXT NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
  "amountCents" INTEGER NOT NULL,
  date TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'other',
  "contactId" TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  memo TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_payee ON payroll_payments("payeeId");
CREATE INDEX IF NOT EXISTS idx_payroll_payments_date ON payroll_payments(date);

CREATE TABLE IF NOT EXISTS plaid_items (
  id TEXT PRIMARY KEY,
  "itemId" TEXT UNIQUE NOT NULL,
  "institutionName" TEXT NOT NULL,
  "encryptedAccessToken" TEXT NOT NULL,
  "transactionsCursor" TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  "plaidItemId" TEXT NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  "plaidAccountId" TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  mask TEXT,
  type TEXT,
  subtype TEXT,
  "currentBalanceCents" INTEGER,
  "availableBalanceCents" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_item ON bank_accounts("plaidItemId");

CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  "bankAccountId" TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  "plaidTransactionId" TEXT UNIQUE NOT NULL,
  "amountCents" INTEGER NOT NULL,
  date TEXT NOT NULL,
  "merchantName" TEXT,
  "plaidCategory" TEXT,
  "userCategory" TEXT,
  "contactId" TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  pending BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions("bankAccountId");
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date);
`
