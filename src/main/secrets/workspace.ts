import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { scryptSync } from 'crypto'

// Fixed, non-secret salt. Every machine must derive the identical AES key from the
// same workspace passphrase so they can decrypt each other's encrypted settings rows
// in the shared database — a random per-install salt would break that.
const KDF_SALT = 'unified-integration-crm-workspace-v1'

interface StoredWorkspace {
  encryptedConnectionString: string // base64
  encryptedKeyHex: string // base64 (safeStorage-wrapped hex of the derived AES key)
}

export interface WorkspaceConfig {
  connectionString: string
  encryptionKey: Buffer
}

function workspacePath(): string {
  return join(app.getPath('userData'), 'workspace.json')
}

function deriveKey(passphrase: string): Buffer {
  return scryptSync(passphrase, KDF_SALT, 32)
}

export function hasWorkspaceConfig(): boolean {
  return existsSync(workspacePath())
}

export function loadWorkspaceConfig(): WorkspaceConfig | null {
  const path = workspacePath()
  if (!existsSync(path)) return null

  const stored = JSON.parse(readFileSync(path, 'utf-8')) as StoredWorkspace
  const connectionString = safeStorage.decryptString(
    Buffer.from(stored.encryptedConnectionString, 'base64')
  )
  const keyHex = safeStorage.decryptString(Buffer.from(stored.encryptedKeyHex, 'base64'))
  return { connectionString, encryptionKey: Buffer.from(keyHex, 'hex') }
}

export function saveWorkspaceConfig(connectionString: string, passphrase: string): WorkspaceConfig {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level credential encryption is not available on this machine')
  }
  const encryptionKey = deriveKey(passphrase)
  const stored: StoredWorkspace = {
    encryptedConnectionString: safeStorage.encryptString(connectionString).toString('base64'),
    encryptedKeyHex: safeStorage.encryptString(encryptionKey.toString('hex')).toString('base64')
  }
  writeFileSync(workspacePath(), JSON.stringify(stored), 'utf-8')
  return { connectionString, encryptionKey }
}
