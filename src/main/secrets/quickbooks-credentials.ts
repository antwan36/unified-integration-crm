import { getSetting, setSetting } from '../db/settings'
import { loadWorkspaceConfig } from './workspace'
import { encrypt, decrypt } from './encryption'
import type { QuickBooksCredentials, QuickBooksSettings } from '../../shared/types'

export type { QuickBooksCredentials }

const SETTINGS_KEY = 'quickbooks_credentials'

interface StoredQuickBooks extends QuickBooksCredentials {
  companyName: string | null
}

function encryptionKey(): Buffer {
  const config = loadWorkspaceConfig()
  if (!config) throw new Error('Not connected to a workspace yet')
  return config.encryptionKey
}

export async function saveQuickBooksCredentials(
  creds: QuickBooksCredentials,
  companyName: string | null
): Promise<void> {
  const stored: StoredQuickBooks = { ...creds, companyName }
  await setSetting(SETTINGS_KEY, encrypt(JSON.stringify(stored), encryptionKey()))
}

async function loadStored(): Promise<StoredQuickBooks | null> {
  const raw = await getSetting(SETTINGS_KEY)
  if (!raw) return null
  return JSON.parse(decrypt(raw, encryptionKey())) as StoredQuickBooks
}

export async function loadQuickBooksCredentials(): Promise<QuickBooksCredentials | null> {
  const stored = await loadStored()
  if (!stored) return null
  const { companyName: _companyName, ...creds } = stored
  return creds
}

/** Includes companyName, so callers that refresh tokens can re-save without losing it. */
export async function loadQuickBooksCredentialsWithCompanyName(): Promise<StoredQuickBooks | null> {
  return loadStored()
}

export async function hasQuickBooksCredentials(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY)) !== null
}

export async function quickBooksSettingsSummary(): Promise<QuickBooksSettings | null> {
  const stored = await loadStored()
  if (!stored) return null
  return {
    environment: stored.environment,
    realmId: stored.realmId,
    companyName: stored.companyName,
    hasToken: true
  }
}
