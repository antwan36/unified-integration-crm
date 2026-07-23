import { app } from 'electron'
import { writeFile, mkdtemp, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import type { UpdateCheckResult } from '../shared/types'

const REPO = 'antwan36/unified-integration-crm'
const APP_NAME = 'Unified Integration CRM'

interface GithubAsset {
  name: string
  browser_download_url: string
}

interface GithubRelease {
  tag_name: string
  body: string | null
  assets: GithubAsset[]
}

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number(part) || 0)
}

function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return { updateAvailable: false, currentVersion, latestVersion: null, downloadUrl: null, releaseNotes: null }

    const release = (await res.json()) as GithubRelease
    const latestVersion = release.tag_name.replace(/^v/, '')
    if (!isNewer(latestVersion, currentVersion)) {
      return { updateAvailable: false, currentVersion, latestVersion, downloadUrl: null, releaseNotes: null }
    }

    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    const asset =
      release.assets.find((a) => a.name.endsWith(`${arch}.dmg`)) ??
      release.assets.find((a) => a.name.endsWith('.dmg'))

    return {
      updateAvailable: !!asset,
      currentVersion,
      latestVersion,
      downloadUrl: asset?.browser_download_url ?? null,
      releaseNotes: release.body
    }
  } catch {
    return { updateAvailable: false, currentVersion, latestVersion: null, downloadUrl: null, releaseNotes: null }
  }
}

/**
 * Downloads the new .dmg, then hands off to a detached shell script that waits for this
 * app to quit, swaps /Applications/{APP_NAME}.app for the new build, and relaunches it.
 * The script outlives this process — replacing a running app's files works fine on macOS
 * (unlike Windows) since the OS keeps the old inode open until the process actually exits.
 */
export async function installUpdate(downloadUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(120000) })
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
    const buffer = Buffer.from(await res.arrayBuffer())

    const workDir = await mkdtemp(join(tmpdir(), 'uicrm-update-'))
    const dmgPath = join(workDir, 'update.dmg')
    await writeFile(dmgPath, buffer)

    const scriptPath = join(workDir, 'install.sh')
    const script = `#!/bin/bash
set -e
DMG_PATH="${dmgPath}"
APP_PATH="/Applications/${APP_NAME}.app"

for i in $(seq 1 40); do
  if ! pgrep -f "$APP_PATH/Contents/MacOS/${APP_NAME}" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

MOUNT_DIR=$(mktemp -d)
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

SRC_APP=$(find "$MOUNT_DIR" -maxdepth 1 -name "*.app" | head -1)
if [ -z "$SRC_APP" ]; then
  hdiutil detach "$MOUNT_DIR" -quiet || true
  exit 1
fi

rm -rf "$APP_PATH"
cp -R "$SRC_APP" "$APP_PATH"
xattr -cr "$APP_PATH" 2>/dev/null || true

hdiutil detach "$MOUNT_DIR" -quiet || true
rm -rf "${workDir}"

open "$APP_PATH"
`
    await writeFile(scriptPath, script)
    await chmod(scriptPath, 0o755)

    const child = spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' })
    child.unref()

    setTimeout(() => app.quit(), 300)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
