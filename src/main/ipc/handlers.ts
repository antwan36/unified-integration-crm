import { ipcMain } from 'electron'
import { initDb, ensureSchema, testConnectionString } from '../db'
import { hasWorkspaceConfig, saveWorkspaceConfig } from '../secrets/workspace'
import { scheduleBackgroundSync } from '../backgroundSync'
import { countUsers, createUser, verifyLogin, listUsers, findUserByEmail, deleteUser } from '../db/users'
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  countByStatus,
  countAll,
  countUnmatched,
  recentContacts,
  listStaleLeads,
  findOrCreateContactByEmail
} from '../db/contacts'
import {
  listActivitiesForContact,
  createActivity,
  deleteNote,
  recentActivitiesWithContactName,
  listEmailActivities,
  countUnreadEmails,
  markActivityRead
} from '../db/activities'
import {
  listEmailAccounts,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  loadEmailAccountCredentials,
  migrateLegacyImapAccountIfNeeded
} from '../db/emailAccounts'
import { runImapSyncAll } from '../imap/sync'
import { ImapFlow } from 'imapflow'
import {
  listInvoicesForContact,
  listAllInvoices,
  getInvoice,
  getInvoiceStats,
  getInvoiceAnalytics,
  updateInvoiceCost
} from '../db/invoices'
import {
  createAndSendInvoice,
  deleteOrCancelInvoice,
  markInvoicePaidManually,
  refreshInvoice,
  sendDraftInvoice
} from '../square/invoices'
import { runSquareSync } from '../square/sync'
import { listSquareLocations, SquareApiError } from '../square/client'
import { syncContactToSquare, deleteSquareCustomerIfLinked } from '../square/customers'
import { saveSquareCredentials, squareSettingsSummary } from '../secrets/square-credentials'
import { saveQuickBooksCredentials, quickBooksSettingsSummary } from '../secrets/quickbooks-credentials'
import { testQuickBooksCredentials, QuickBooksApiError } from '../quickbooks/client'
import { runQuickBooksMigration } from '../quickbooks/migrate'
import { sendMail, testSmtpConnection } from '../email/smtp'
import {
  createTask,
  listTasksForContact,
  listOpenTasks,
  setTaskDone,
  deleteTask,
  countOpenDueOrOverdue
} from '../db/tasks'
import {
  createEstimate,
  getEstimate,
  listEstimatesForContact,
  listAllEstimates,
  updateEstimateDraft,
  deleteEstimate
} from '../db/estimates'
import {
  getPortalUrl,
  savePortalUrl,
  sendEstimateForSignature,
  convertEstimateToInvoice
} from '../estimates/actions'
import { getCalendarFeedUrl, resetCalendarFeedToken } from '../calendar/feed'
import { listQueuedReviewRequests, countQueuedReviewRequests } from '../db/reviewRequests'
import {
  getGoogleReviewLink,
  saveGoogleReviewLink,
  sendReviewRequest,
  dismissReviewRequestAction
} from '../reviewRequests/actions'
import {
  listAttachmentsForContact,
  uploadAttachment,
  getAttachmentData,
  deleteAttachment
} from '../db/attachments'
import { exportContactsCsv, exportInvoicesCsv } from '../export'
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem
} from '../db/catalog'
import { scrapeProductUrl } from '../catalog/scrape'
import {
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  listInventoryTransactionsForItem,
  recordInventoryTransaction
} from '../db/inventory'
import { listPayees, createPayee, updatePayee, deletePayee } from '../db/payees'
import {
  listPayrollPayments,
  createPayrollPayment,
  deletePayrollPayment,
  get1099Summary
} from '../db/payroll'
import { savePlaidCredentials, plaidSettingsSummary } from '../secrets/plaid-credentials'
import { createLinkToken, exchangePublicToken } from '../plaid/link'
import { runPlaidSyncAll } from '../plaid/sync'
import { listPlaidItemSummaries, listBankAccounts, listBankTransactions, updateBankTransaction, getFinancesSummary } from '../db/plaid'
import { checkForUpdate, installUpdate } from '../updater'
import { CONTACT_STATUSES } from '../../shared/types'
import type {
  ContactWithActivities,
  CreateCatalogItemInput,
  CreateContactInput,
  CreateEstimateInput,
  CreateInvoiceInput,
  CreateEmailAccountInput,
  CreateInventoryItemInput,
  CreateInventoryTransactionInput,
  CreatePayeeInput,
  CreatePayrollPaymentInput,
  CreateTaskInput,
  DashboardStats,
  ListContactsFilter,
  SendEmailInput,
  SquareCredentials,
  SquareTestResult,
  QuickBooksCredentials,
  QuickBooksTestResult,
  ListEmailsFilter,
  TestEmailAccountInput,
  TestSmtpAccountInput,
  UpdateCatalogItemInput,
  UpdateContactInput,
  UpdateEmailAccountInput,
  UpdateEstimateInput,
  UpdateBankTransactionInput,
  UpdateInventoryItemInput,
  UpdatePayeeInput,
  PlaidCredentials,
  UploadAttachmentInput
} from '../../shared/types'

export function registerIpcHandlers(): void {
  // --- Workspace ---
  ipcMain.handle('workspace:hasConfig', () => hasWorkspaceConfig())

  ipcMain.handle('workspace:test', async (_event, connectionString: string) =>
    testConnectionString(connectionString)
  )

  ipcMain.handle(
    'workspace:connect',
    async (_event, { connectionString, passphrase }: { connectionString: string; passphrase: string }) => {
      const test = await testConnectionString(connectionString)
      if (!test.ok) return test

      saveWorkspaceConfig(connectionString, passphrase)
      initDb(connectionString)
      await ensureSchema()
      await migrateLegacyImapAccountIfNeeded()
      scheduleBackgroundSync()
      return { ok: true }
    }
  )

  // --- Auth ---
  ipcMain.handle('auth:hasUser', async () => (await countUsers()) > 0)

  ipcMain.handle(
    'auth:setup',
    async (_event, { email, password, name }: { email: string; password: string; name: string }) => {
      if ((await countUsers()) > 0) throw new Error('An account already exists')
      if (!email || !password || password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      return createUser(email, password, name)
    }
  )

  ipcMain.handle(
    'auth:login',
    async (_event, { email, password }: { email: string; password: string }) => {
      return verifyLogin(email, password)
    }
  )

  ipcMain.handle('users:list', async () => listUsers())

  ipcMain.handle(
    'auth:createUser',
    async (_event, { email, password, name }: { email: string; password: string; name: string }) => {
      if (!email || !password || password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      if (await findUserByEmail(email)) {
        throw new Error('An account with that email already exists')
      }
      return createUser(email, password, name, 'member')
    }
  )

  ipcMain.handle('users:delete', async (_event, id: string) => {
    await deleteUser(id)
  })

  // --- Contacts ---
  ipcMain.handle('contacts:list', async (_event, filter: ListContactsFilter) =>
    listContacts(filter)
  )

  ipcMain.handle('contacts:get', async (_event, id: string): Promise<ContactWithActivities | null> => {
    const contact = await getContact(id)
    if (!contact) return null
    return { ...contact, activities: await listActivitiesForContact(id) }
  })

  ipcMain.handle('contacts:create', async (_event, input: CreateContactInput) =>
    createContact(input)
  )

  ipcMain.handle(
    'contacts:update',
    async (_event, { id, input }: { id: string; input: UpdateContactInput }) => {
      const updated = await updateContact(id, input)
      if (updated && (input.name !== undefined || input.email !== undefined || input.phone !== undefined)) {
        await syncContactToSquare(id)
      }
      return updated
    }
  )

  ipcMain.handle('contacts:delete', async (_event, id: string) => {
    await deleteSquareCustomerIfLinked(id)
    await deleteContact(id)
  })

  ipcMain.handle(
    'contacts:addNote',
    async (
      _event,
      { contactId, body, subject }: { contactId: string; body: string; subject?: string | null }
    ) => createActivity({ contactId, type: 'note', subject: subject ?? null, body, direction: null })
  )

  ipcMain.handle('contacts:deleteNote', async (_event, activityId: string) =>
    deleteNote(activityId)
  )

  // --- Dashboard ---
  ipcMain.handle('dashboard:stats', async (): Promise<DashboardStats> => {
    const [counts, totalContacts, unmatchedCount, recent, recentActivities, staleLeads] =
      await Promise.all([
        countByStatus(),
        countAll(),
        countUnmatched(),
        recentContacts(5),
        recentActivitiesWithContactName(10),
        listStaleLeads(5)
      ])
    const statusCounts = Object.fromEntries(
      CONTACT_STATUSES.map((s) => [s, counts[s] ?? 0])
    ) as DashboardStats['statusCounts']

    return {
      statusCounts,
      totalContacts,
      unmatchedCount,
      recentContacts: recent,
      recentActivities,
      staleLeads
    }
  })

  // --- Email accounts ---
  ipcMain.handle('emailAccounts:list', async () => listEmailAccounts())

  ipcMain.handle('emailAccounts:create', async (_event, input: CreateEmailAccountInput) =>
    createEmailAccount(input)
  )

  ipcMain.handle(
    'emailAccounts:update',
    async (_event, { id, input }: { id: string; input: UpdateEmailAccountInput }) =>
      updateEmailAccount(id, input)
  )

  ipcMain.handle('emailAccounts:delete', async (_event, id: string) => deleteEmailAccount(id))

  ipcMain.handle('emailAccounts:test', async (_event, creds: TestEmailAccountInput) => {
    const client = new ImapFlow({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth: { user: creds.user, pass: creds.password },
      logger: false
    })
    try {
      await client.connect()
      await client.logout()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('emailAccounts:testSmtp', async (_event, creds: TestSmtpAccountInput) =>
    testSmtpConnection(creds)
  )

  ipcMain.handle('sync:run', async () => runImapSyncAll())

  ipcMain.handle('sync:status', async () => {
    const accounts = await listEmailAccounts()
    return { configured: accounts.length > 0 }
  })

  // --- Email send ---
  ipcMain.handle('email:send', async (_event, input: SendEmailInput) => {
    const account = await loadEmailAccountCredentials(input.emailAccountId)
    if (!account) throw new Error('That email account no longer exists.')
    const sent = await sendMail({
      account: {
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        smtpSecure: account.smtpSecure,
        user: account.user,
        password: account.password
      },
      to: input.to,
      subject: input.subject,
      text: input.body,
      inReplyTo: input.inReplyTo,
      references: input.references
    })
    return createActivity({
      contactId: input.contactId,
      type: 'email',
      subject: input.subject,
      body: input.body,
      direction: 'outbound',
      messageId: sent.messageId,
      emailAccountId: input.emailAccountId
    })
  })

  ipcMain.handle('email:list', async (_event, filter: ListEmailsFilter = {}) =>
    listEmailActivities(filter)
  )

  ipcMain.handle('email:unreadCount', async () => countUnreadEmails())

  ipcMain.handle('email:markRead', async (_event, id: string) => markActivityRead(id))

  ipcMain.handle(
    'contacts:findOrCreateByEmail',
    async (_event, { email, name }: { email: string; name?: string | null }) =>
      findOrCreateContactByEmail(email, name)
  )

  // --- Attachments ---
  ipcMain.handle('attachments:listForContact', async (_event, contactId: string) =>
    listAttachmentsForContact(contactId)
  )

  ipcMain.handle('attachments:upload', async (_event, input: UploadAttachmentInput) =>
    uploadAttachment(input)
  )

  ipcMain.handle('attachments:download', async (_event, id: string) => {
    const result = await getAttachmentData(id)
    if (!result) return null
    return {
      filename: result.filename,
      mimeType: result.mimeType,
      data: Uint8Array.from(result.data).buffer
    }
  })

  ipcMain.handle('attachments:delete', async (_event, id: string) => {
    await deleteAttachment(id)
  })

  // --- Invoices ---
  ipcMain.handle('invoices:listForContact', async (_event, contactId: string) =>
    listInvoicesForContact(contactId)
  )

  ipcMain.handle('invoices:listAll', async () => listAllInvoices())

  ipcMain.handle('invoices:stats', async () => getInvoiceStats())

  ipcMain.handle('invoices:analytics', async () => getInvoiceAnalytics())

  ipcMain.handle('invoices:get', async (_event, id: string) => getInvoice(id))

  ipcMain.handle('invoices:create', async (_event, input: CreateInvoiceInput) =>
    createAndSendInvoice(input)
  )

  ipcMain.handle('invoices:refresh', async (_event, id: string) => {
    await refreshInvoice(id)
    return getInvoice(id)
  })

  ipcMain.handle('invoices:sendDraft', async (_event, id: string) => sendDraftInvoice(id))

  ipcMain.handle('invoices:delete', async (_event, id: string) => deleteOrCancelInvoice(id))

  ipcMain.handle('invoices:updateCost', async (_event, id: string, costCents: number) =>
    updateInvoiceCost(id, costCents)
  )

  ipcMain.handle('invoices:markPaid', async (_event, id: string) => markInvoicePaidManually(id))

  // --- Settings / Square ---
  ipcMain.handle('settings:getSquare', async () => squareSettingsSummary())

  ipcMain.handle(
    'settings:saveSquare',
    async (_event, { creds, locationName }: { creds: SquareCredentials; locationName: string | null }) => {
      await saveSquareCredentials(creds, locationName)
    }
  )

  ipcMain.handle(
    'settings:testSquare',
    async (
      _event,
      creds: Pick<SquareCredentials, 'accessToken' | 'environment'>
    ): Promise<SquareTestResult> => {
      try {
        const locations = await listSquareLocations(creds)
        return { ok: true, locations }
      } catch (err) {
        const message =
          err instanceof SquareApiError ? err.message : err instanceof Error ? err.message : String(err)
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle('square:sync', async () => runSquareSync())

  // --- Settings / QuickBooks ---
  ipcMain.handle('settings:getQuickBooks', async () => quickBooksSettingsSummary())

  ipcMain.handle(
    'settings:testQuickBooks',
    async (_event, creds: QuickBooksCredentials): Promise<QuickBooksTestResult> => {
      try {
        const { companyName } = await testQuickBooksCredentials(creds)
        return { ok: true, companyName }
      } catch (err) {
        const message =
          err instanceof QuickBooksApiError ? err.message : err instanceof Error ? err.message : String(err)
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle('settings:saveQuickBooks', async (_event, creds: QuickBooksCredentials) => {
    // Re-validate + capture the exchanged (possibly rotated) token pair and company name
    // right before saving, rather than trusting whatever the renderer last tested with.
    const { companyName, validated } = await testQuickBooksCredentials(creds)
    await saveQuickBooksCredentials(validated, companyName)
  })

  ipcMain.handle('quickbooks:migrate', async () => runQuickBooksMigration())

  // --- Tasks ---
  ipcMain.handle('tasks:listForContact', async (_event, contactId: string) =>
    listTasksForContact(contactId)
  )

  ipcMain.handle('tasks:listOpen', async () => listOpenTasks())

  ipcMain.handle('tasks:counts', async () => countOpenDueOrOverdue())

  ipcMain.handle('tasks:create', async (_event, input: CreateTaskInput) => createTask(input))

  ipcMain.handle(
    'tasks:setDone',
    async (_event, { id, done }: { id: string; done: boolean }) => {
      const task = await setTaskDone(id, done)
      if (task && done) {
        await createActivity({
          contactId: task.contactId,
          type: 'task',
          subject: `Task completed — ${task.title}`,
          body: null,
          direction: null
        })
      }
      return task
    }
  )

  ipcMain.handle('tasks:delete', async (_event, id: string) => {
    await deleteTask(id)
  })

  // --- Estimates ---
  ipcMain.handle('estimates:listForContact', async (_event, contactId: string) =>
    listEstimatesForContact(contactId)
  )

  ipcMain.handle('estimates:listAll', async () => listAllEstimates())

  ipcMain.handle('estimates:get', async (_event, id: string) => getEstimate(id))

  ipcMain.handle('estimates:create', async (_event, input: CreateEstimateInput) =>
    createEstimate(input)
  )

  ipcMain.handle(
    'estimates:update',
    async (_event, { id, input }: { id: string; input: UpdateEstimateInput }) =>
      updateEstimateDraft(id, input)
  )

  ipcMain.handle('estimates:delete', async (_event, id: string) => {
    await deleteEstimate(id)
  })

  ipcMain.handle('estimates:send', async (_event, id: string) => sendEstimateForSignature(id))

  ipcMain.handle(
    'estimates:convertToInvoice',
    async (_event, { id, dueDate }: { id: string; dueDate: string }) =>
      convertEstimateToInvoice(id, dueDate)
  )

  // --- Review requests ---
  ipcMain.handle('reviewRequests:list', async () => listQueuedReviewRequests())
  ipcMain.handle('reviewRequests:count', async () => countQueuedReviewRequests())
  ipcMain.handle('reviewRequests:send', async (_event, id: string) => sendReviewRequest(id))
  ipcMain.handle('reviewRequests:dismiss', async (_event, id: string) => {
    await dismissReviewRequestAction(id)
  })
  ipcMain.handle('settings:getGoogleReviewLink', async () => getGoogleReviewLink())
  ipcMain.handle('settings:saveGoogleReviewLink', async (_event, url: string) => {
    await saveGoogleReviewLink(url)
  })

  // --- Catalog ---
  ipcMain.handle('catalog:list', async () => listCatalogItems())

  ipcMain.handle('catalog:create', async (_event, input: CreateCatalogItemInput) =>
    createCatalogItem(input)
  )

  ipcMain.handle(
    'catalog:update',
    async (_event, { id, input }: { id: string; input: UpdateCatalogItemInput }) =>
      updateCatalogItem(id, input)
  )

  ipcMain.handle('catalog:delete', async (_event, id: string) => {
    await deleteCatalogItem(id)
  })

  ipcMain.handle('catalog:scrapeUrl', async (_event, url: string) => {
    try {
      const product = await scrapeProductUrl(url)
      return { ok: true, product }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // --- Inventory ---
  ipcMain.handle('inventory:list', async () => listInventoryItems())

  ipcMain.handle('inventory:create', async (_event, input: CreateInventoryItemInput) =>
    createInventoryItem(input)
  )

  ipcMain.handle(
    'inventory:update',
    async (_event, { id, input }: { id: string; input: UpdateInventoryItemInput }) =>
      updateInventoryItem(id, input)
  )

  ipcMain.handle('inventory:delete', async (_event, id: string) => {
    await deleteInventoryItem(id)
  })

  ipcMain.handle('inventory:listTransactions', async (_event, itemId: string) =>
    listInventoryTransactionsForItem(itemId)
  )

  ipcMain.handle(
    'inventory:recordTransaction',
    async (_event, input: CreateInventoryTransactionInput) => recordInventoryTransaction(input)
  )

  // --- Payroll ---
  ipcMain.handle('payees:list', async () => listPayees())

  ipcMain.handle('payees:create', async (_event, input: CreatePayeeInput) => createPayee(input))

  ipcMain.handle(
    'payees:update',
    async (_event, { id, input }: { id: string; input: UpdatePayeeInput }) => updatePayee(id, input)
  )

  ipcMain.handle('payees:delete', async (_event, id: string) => {
    await deletePayee(id)
  })

  ipcMain.handle('payroll:listPayments', async () => listPayrollPayments())

  ipcMain.handle('payroll:createPayment', async (_event, input: CreatePayrollPaymentInput) =>
    createPayrollPayment(input)
  )

  ipcMain.handle('payroll:deletePayment', async (_event, id: string) => {
    await deletePayrollPayment(id)
  })

  ipcMain.handle('payroll:get1099Summary', async (_event, year: number) => get1099Summary(year))

  // --- Plaid / Bank sync ---
  ipcMain.handle('settings:getPlaid', async () => plaidSettingsSummary())

  ipcMain.handle('settings:savePlaid', async (_event, creds: PlaidCredentials) => {
    await savePlaidCredentials(creds)
  })

  ipcMain.handle('plaid:createLinkToken', async () => createLinkToken())

  ipcMain.handle(
    'plaid:exchangePublicToken',
    async (_event, { publicToken, institutionName }: { publicToken: string; institutionName: string }) =>
      exchangePublicToken(publicToken, institutionName)
  )

  ipcMain.handle('plaid:sync', async () => runPlaidSyncAll())

  ipcMain.handle('plaid:listItems', async () => listPlaidItemSummaries())

  ipcMain.handle('bankAccounts:list', async () => listBankAccounts())

  ipcMain.handle('bankTransactions:list', async () => listBankTransactions())

  ipcMain.handle(
    'bankTransactions:update',
    async (_event, { id, input }: { id: string; input: UpdateBankTransactionInput }) =>
      updateBankTransaction(id, input)
  )

  ipcMain.handle('finances:summary', async () => getFinancesSummary())

  // --- Export ---
  ipcMain.handle('export:contacts', async () => exportContactsCsv())

  ipcMain.handle('export:invoices', async () => exportInvoicesCsv())

  ipcMain.handle('settings:getPortalUrl', async () => getPortalUrl())

  ipcMain.handle('settings:savePortalUrl', async (_event, url: string) => {
    await savePortalUrl(url)
  })

  ipcMain.handle('settings:getCalendarFeedUrl', async () => getCalendarFeedUrl())

  ipcMain.handle('settings:resetCalendarFeedToken', async () => {
    await resetCalendarFeedToken()
    return getCalendarFeedUrl()
  })

  // --- App updates ---
  ipcMain.handle('updates:check', async () => checkForUpdate())

  ipcMain.handle('updates:install', async (_event, downloadUrl: string) => installUpdate(downloadUrl))
}
