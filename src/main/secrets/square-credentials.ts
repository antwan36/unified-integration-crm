import { getSetting, setSetting } from '../db/settings'
import { loadWorkspaceConfig } from './workspace'
import { encrypt, decrypt } from './encryption'
import type { SquareCredentials, SquareEnvironment, SquareSettings } from '../../shared/types'

export type { SquareCredentials }

const SETTINGS_KEY = 'square_credentials'

interface StoredSquare {
  accessToken: string
  environment: SquareEnvironment
  locationId: string
  locationName: string | null
}

function encryptionKey(): Buffer {
  const config = loadWorkspaceConfig()
  if (!config) throw new Error('Not connected to a workspace yet')
  return config.encryptionKey
}

export async function saveSquareCredentials(
  creds: SquareCredentials,
  locationName: string | null
): Promise<void> {
  const stored: StoredSquare = { ...creds, locationName }
  await setSetting(SETTINGS_KEY, encrypt(JSON.stringify(stored), encryptionKey()))
}

async function loadStored(): Promise<StoredSquare | null> {
  const raw = await getSetting(SETTINGS_KEY)
  if (!raw) return null
  return JSON.parse(decrypt(raw, encryptionKey())) as StoredSquare
}

export async function loadSquareCredentials(): Promise<SquareCredentials | null> {
  const stored = await loadStored()
  if (!stored) return null
  return {
    accessToken: stored.accessToken,
    environment: stored.environment,
    locationId: stored.locationId
  }
}

export async function hasSquareCredentials(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY)) !== null
}

export async function squareSettingsSummary(): Promise<SquareSettings | null> {
  const stored = await loadStored()
  if (!stored) return null
  return {
    environment: stored.environment,
    locationId: stored.locationId,
    locationName: stored.locationName,
    hasToken: true
  }
}
