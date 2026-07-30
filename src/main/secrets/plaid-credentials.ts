import { getSetting, setSetting } from '../db/settings'
import { loadWorkspaceConfig } from './workspace'
import { encrypt, decrypt } from './encryption'
import type { PlaidCredentials, PlaidSettings } from '../../shared/types'

export type { PlaidCredentials }

const SETTINGS_KEY = 'plaid_credentials'

function encryptionKey(): Buffer {
  const config = loadWorkspaceConfig()
  if (!config) throw new Error('Not connected to a workspace yet')
  return config.encryptionKey
}

export async function savePlaidCredentials(creds: PlaidCredentials): Promise<void> {
  await setSetting(SETTINGS_KEY, encrypt(JSON.stringify(creds), encryptionKey()))
}

export async function loadPlaidCredentials(): Promise<PlaidCredentials | null> {
  const raw = await getSetting(SETTINGS_KEY)
  if (!raw) return null
  return JSON.parse(decrypt(raw, encryptionKey())) as PlaidCredentials
}

export async function hasPlaidCredentials(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY)) !== null
}

export async function plaidSettingsSummary(): Promise<PlaidSettings | null> {
  const creds = await loadPlaidCredentials()
  if (!creds) return null
  return { environment: creds.environment, hasCredentials: true }
}
