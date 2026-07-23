import { contextBridge, ipcRenderer } from 'electron'
import type {
  Activity,
  Attachment,
  AttachmentData,
  AuthUser,
  CatalogItem,
  Contact,
  ContactStatus,
  ContactWithActivities,
  CreateCatalogItemInput,
  CreateContactInput,
  CreateEmailAccountInput,
  CreateEstimateInput,
  CreateInvoiceInput,
  CreateTaskInput,
  DashboardStats,
  EmailAccount,
  EmailListResult,
  Estimate,
  EstimateWithContactName,
  EstimateWithItems,
  Invoice,
  InvoiceAnalytics,
  InvoiceStats,
  InvoiceWithContactName,
  InvoiceWithLineItems,
  ListContactsFilter,
  ListEmailsFilter,
  SendEmailInput,
  SquareCredentials,
  SquareSettings,
  ScrapeProductResult,
  SquareSyncResult,
  SquareTestResult,
  SyncResult,
  Task,
  TaskWithContactName,
  TeamMember,
  TestEmailAccountInput,
  UpdateCatalogItemInput,
  UpdateCheckResult,
  UpdateContactInput,
  UpdateEmailAccountInput,
  UpdateEstimateInput,
  UploadAttachmentInput
} from '../shared/types'

const api = {
  workspace: {
    hasConfig: (): Promise<boolean> => ipcRenderer.invoke('workspace:hasConfig'),
    test: (connectionString: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('workspace:test', connectionString),
    connect: (connectionString: string, passphrase: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('workspace:connect', { connectionString, passphrase })
  },
  auth: {
    hasUser: (): Promise<boolean> => ipcRenderer.invoke('auth:hasUser'),
    setup: (email: string, password: string, name: string): Promise<AuthUser> =>
      ipcRenderer.invoke('auth:setup', { email, password, name }),
    login: (email: string, password: string): Promise<AuthUser | null> =>
      ipcRenderer.invoke('auth:login', { email, password }),
    createUser: (email: string, password: string, name: string): Promise<AuthUser> =>
      ipcRenderer.invoke('auth:createUser', { email, password, name })
  },
  users: {
    list: (): Promise<TeamMember[]> => ipcRenderer.invoke('users:list'),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('users:delete', id)
  },
  contacts: {
    list: (filter: ListContactsFilter = {}): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:list', filter),
    get: (id: string): Promise<ContactWithActivities | null> =>
      ipcRenderer.invoke('contacts:get', id),
    create: (input: CreateContactInput): Promise<Contact> =>
      ipcRenderer.invoke('contacts:create', input),
    update: (id: string, input: UpdateContactInput): Promise<Contact | null> =>
      ipcRenderer.invoke('contacts:update', { id, input }),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('contacts:delete', id),
    addNote: (contactId: string, body: string, subject?: string | null): Promise<Activity> =>
      ipcRenderer.invoke('contacts:addNote', { contactId, body, subject }),
    findOrCreateByEmail: (email: string, name?: string | null): Promise<Contact> =>
      ipcRenderer.invoke('contacts:findOrCreateByEmail', { email, name })
  },
  dashboard: {
    stats: (): Promise<DashboardStats> => ipcRenderer.invoke('dashboard:stats')
  },
  emailAccounts: {
    list: (): Promise<EmailAccount[]> => ipcRenderer.invoke('emailAccounts:list'),
    create: (input: CreateEmailAccountInput): Promise<EmailAccount> =>
      ipcRenderer.invoke('emailAccounts:create', input),
    update: (id: string, input: UpdateEmailAccountInput): Promise<EmailAccount | null> =>
      ipcRenderer.invoke('emailAccounts:update', { id, input }),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('emailAccounts:delete', id),
    test: (creds: TestEmailAccountInput): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('emailAccounts:test', creds)
  },
  settings: {
    getSquare: (): Promise<SquareSettings | null> => ipcRenderer.invoke('settings:getSquare'),
    saveSquare: (creds: SquareCredentials, locationName: string | null): Promise<void> =>
      ipcRenderer.invoke('settings:saveSquare', { creds, locationName }),
    testSquare: (
      creds: Pick<SquareCredentials, 'accessToken' | 'environment'>
    ): Promise<SquareTestResult> => ipcRenderer.invoke('settings:testSquare', creds),
    getPortalUrl: (): Promise<string | null> => ipcRenderer.invoke('settings:getPortalUrl'),
    savePortalUrl: (url: string): Promise<void> =>
      ipcRenderer.invoke('settings:savePortalUrl', url),
    getCalendarFeedUrl: (): Promise<string | null> =>
      ipcRenderer.invoke('settings:getCalendarFeedUrl'),
    resetCalendarFeedToken: (): Promise<string | null> =>
      ipcRenderer.invoke('settings:resetCalendarFeedToken')
  },
  sync: {
    run: (): Promise<SyncResult> => ipcRenderer.invoke('sync:run'),
    status: (): Promise<{ configured: boolean }> => ipcRenderer.invoke('sync:status')
  },
  square: {
    sync: (): Promise<SquareSyncResult> => ipcRenderer.invoke('square:sync')
  },
  tasks: {
    listForContact: (contactId: string): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:listForContact', contactId),
    listOpen: (): Promise<TaskWithContactName[]> => ipcRenderer.invoke('tasks:listOpen'),
    counts: (): Promise<{ overdue: number; dueToday: number }> =>
      ipcRenderer.invoke('tasks:counts'),
    create: (input: CreateTaskInput): Promise<Task> => ipcRenderer.invoke('tasks:create', input),
    setDone: (id: string, done: boolean): Promise<Task | null> =>
      ipcRenderer.invoke('tasks:setDone', { id, done }),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('tasks:delete', id)
  },
  invoices: {
    listForContact: (contactId: string): Promise<Invoice[]> =>
      ipcRenderer.invoke('invoices:listForContact', contactId),
    listAll: (): Promise<InvoiceWithContactName[]> => ipcRenderer.invoke('invoices:listAll'),
    stats: (): Promise<InvoiceStats> => ipcRenderer.invoke('invoices:stats'),
    analytics: (): Promise<InvoiceAnalytics> => ipcRenderer.invoke('invoices:analytics'),
    get: (id: string): Promise<InvoiceWithLineItems | null> =>
      ipcRenderer.invoke('invoices:get', id),
    create: (input: CreateInvoiceInput): Promise<InvoiceWithLineItems> =>
      ipcRenderer.invoke('invoices:create', input),
    refresh: (id: string): Promise<InvoiceWithLineItems | null> =>
      ipcRenderer.invoke('invoices:refresh', id),
    sendDraft: (id: string): Promise<InvoiceWithLineItems | null> =>
      ipcRenderer.invoke('invoices:sendDraft', id),
    delete: (id: string): Promise<{ deleted: boolean }> =>
      ipcRenderer.invoke('invoices:delete', id)
  },
  email: {
    send: (input: SendEmailInput): Promise<Activity> => ipcRenderer.invoke('email:send', input),
    list: (filter: ListEmailsFilter = {}): Promise<EmailListResult> =>
      ipcRenderer.invoke('email:list', filter),
    unreadCount: (): Promise<number> => ipcRenderer.invoke('email:unreadCount'),
    markRead: (id: string): Promise<void> => ipcRenderer.invoke('email:markRead', id)
  },
  attachments: {
    listForContact: (contactId: string): Promise<Attachment[]> =>
      ipcRenderer.invoke('attachments:listForContact', contactId),
    upload: (input: UploadAttachmentInput): Promise<Attachment> =>
      ipcRenderer.invoke('attachments:upload', input),
    download: (id: string): Promise<AttachmentData | null> =>
      ipcRenderer.invoke('attachments:download', id),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('attachments:delete', id)
  },
  estimates: {
    listForContact: (contactId: string): Promise<Estimate[]> =>
      ipcRenderer.invoke('estimates:listForContact', contactId),
    listAll: (): Promise<EstimateWithContactName[]> => ipcRenderer.invoke('estimates:listAll'),
    get: (id: string): Promise<EstimateWithItems | null> => ipcRenderer.invoke('estimates:get', id),
    create: (input: CreateEstimateInput): Promise<EstimateWithItems> =>
      ipcRenderer.invoke('estimates:create', input),
    update: (id: string, input: UpdateEstimateInput): Promise<EstimateWithItems | null> =>
      ipcRenderer.invoke('estimates:update', { id, input }),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('estimates:delete', id),
    send: (id: string): Promise<{ estimate: EstimateWithItems; signUrl: string }> =>
      ipcRenderer.invoke('estimates:send', id),
    convertToInvoice: (id: string, dueDate: string): Promise<InvoiceWithLineItems> =>
      ipcRenderer.invoke('estimates:convertToInvoice', { id, dueDate })
  },
  export: {
    contacts: (): Promise<{ ok: boolean; path?: string }> => ipcRenderer.invoke('export:contacts'),
    invoices: (): Promise<{ ok: boolean; path?: string }> => ipcRenderer.invoke('export:invoices')
  },
  catalog: {
    list: (): Promise<CatalogItem[]> => ipcRenderer.invoke('catalog:list'),
    create: (input: CreateCatalogItemInput): Promise<CatalogItem> =>
      ipcRenderer.invoke('catalog:create', input),
    update: (id: string, input: UpdateCatalogItemInput): Promise<CatalogItem | null> =>
      ipcRenderer.invoke('catalog:update', { id, input }),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('catalog:delete', id),
    scrapeUrl: (url: string): Promise<ScrapeProductResult> =>
      ipcRenderer.invoke('catalog:scrapeUrl', url)
  },
  updates: {
    check: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('updates:check'),
    install: (downloadUrl: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('updates:install', downloadUrl)
  }
}

export type Api = typeof api
export type { ContactStatus }

contextBridge.exposeInMainWorld('api', api)
