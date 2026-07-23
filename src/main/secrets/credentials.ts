import { getSetting } from '../db/settings'
import { loadWorkspaceConfig } from './workspace'
import { decrypt } from './encryption'
import type { ImapCredentials } from '../../shared/types'

const SETTINGS_KEY = 'imap_credentials'

function encryptionKey(): Buffer {
  const config = loadWorkspaceConfig()
  if (!config) throw new Error('Not connected to a workspace yet')
  return config.encryptionKey
}

/**
 * Reads the single account this app used to support before multi-account email_accounts existed.
 * Only used by migrateLegacyImapAccountIfNeeded() to carry that account forward one time.
 */
export async function loadImapCredentials(): Promise<ImapCredentials | null> {
  const raw = await getSetting(SETTINGS_KEY)
  if (!raw) return null
  return JSON.parse(decrypt(raw, encryptionKey())) as ImapCredentials
}
