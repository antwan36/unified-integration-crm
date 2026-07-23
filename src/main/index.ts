import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { initDb, ensureSchema } from './db'
import { loadWorkspaceConfig } from './secrets/workspace'
import { scheduleBackgroundSync } from './backgroundSync'
import { migrateLegacyImapAccountIfNeeded } from './db/emailAccounts'

// Dev (`npx electron .` / `npm run dev`) and the packaged app must never share local
// storage — otherwise resetting dev test data (workspace connection, credentials) wipes
// the real installed app's state too, since they'd otherwise use the same userData folder.
if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('userData'), '../unified-integration-crm-dev'))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Plain <a href="mailto:…"> / "tel:…" links navigate in place rather than opening a
  // new window, so they bypass setWindowOpenHandler — hand them to the OS instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('http')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.unifiedintegration.crm')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  const workspaceConfig = loadWorkspaceConfig()
  if (workspaceConfig) {
    initDb(workspaceConfig.connectionString)
    try {
      await ensureSchema()
      await migrateLegacyImapAccountIfNeeded()
      scheduleBackgroundSync()
    } catch (err) {
      console.error('Failed to connect to the workspace database on startup:', err)
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
