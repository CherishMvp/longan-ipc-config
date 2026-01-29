import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'

// Configure logging
log.transports.file.level = 'info'
autoUpdater.logger = log

// Force dev update config (if needed for local testing)
autoUpdater.forceDevUpdateConfig = true 

export function initUpdater(mainWindow: BrowserWindow) {
  // --- Event Listeners ---

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('updater-message', { type: 'checking', msg: '正在检查更新...' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater-message', { type: 'available', msg: `发现新版本 v${info.version}`, info })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater-message', { type: 'not-available', msg: '当前已是最新版本' })
  })

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('updater-message', { type: 'error', msg: `更新错误: ${err.message}` })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('updater-progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('updater-message', { type: 'downloaded', msg: '更新下载完成，重启生效', info })
  })

  // --- IPC Handlers ---

  ipcMain.handle('check-for-update', async () => {
    try {
        // In dev mode, this usually does nothing unless configured
        const result = await autoUpdater.checkForUpdates()
        // Only return serializable info
        return { 
            success: true, 
            versionInfo: result?.updateInfo 
        }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
  })

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall()
  })
}
