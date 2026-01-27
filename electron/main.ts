import { app, BrowserWindow, ipcMain, net, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initDB, getDB } from './db'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null

// Initialize Database
const db = initDB()

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false,
    titleBarStyle: 'hidden',
    icon: join(__dirname, '../public/icon.png'),
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}

// Window Controls IPC
ipcMain.on('minimize-window', () => {
  mainWindow?.minimize()
})

ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('close-window', () => {
  mainWindow?.close()
})

// Database IPC
ipcMain.handle('db-get-devices', () => {
  return db.prepare('SELECT * FROM devices ORDER BY created_at DESC').all()
})

ipcMain.handle('db-add-device', (_event, device) => {
  try {
    const stmt = db.prepare('INSERT INTO devices (name, ip, authId, status) VALUES (@name, @ip, @authId, @status)')
    const info = stmt.run(device)
    return { success: true, id: info.lastInsertRowid }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('db-remove-device', (_event, id) => {
  const stmt = db.prepare('DELETE FROM devices WHERE id = ?')
  stmt.run(id)
  return { success: true }
})

ipcMain.handle('db-update-device-status', (_event, { id, status }) => {
  const stmt = db.prepare('UPDATE devices SET status = ? WHERE id = ?')
  stmt.run(status, id)
  return { success: true }
})

ipcMain.handle('db-get-logs', (_event, limit = 100) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT ?').all(limit)
  // Parse data field if it exists
  return logs.map((log: any) => ({
    ...log,
    data: log.data ? JSON.parse(log.data) : null
  }))
})

ipcMain.handle('db-add-log', (_event, log) => {
  const stmt = db.prepare('INSERT INTO logs (type, message, data) VALUES (@type, @message, @data)')
  stmt.run({
    ...log,
    data: log.data ? JSON.stringify(log.data) : null
  })
  return { success: true }
})

ipcMain.handle('db-clear-logs', () => {
  db.prepare('DELETE FROM logs').run()
  return { success: true }
})

// Config persistence
ipcMain.handle('db-save-config', (_event, config) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
  const run = db.transaction((conf) => {
    for (const [key, value] of Object.entries(conf)) {
      stmt.run(key, JSON.stringify(value))
    }
  })
  run(config)
  return { success: true }
})

ipcMain.handle('db-get-config', () => {
  const rows = db.prepare('SELECT key, value FROM config').all() as {key: string, value: string}[]
  const config: Record<string, any> = {}
  for (const row of rows) {
    config[row.key] = JSON.parse(row.value)
  }
  return config
})

// HTTP Proxy
ipcMain.handle('http-request', async (_event, options: {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}) => {
  return new Promise((resolve) => {
    try {
      const request = net.request({
        method: options.method,
        url: options.url
      })

      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          request.setHeader(key, value)
        })
      }

      let responseData = ''

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk.toString()
        })

        response.on('end', () => {
          try {
            const data = JSON.parse(responseData)
            resolve({ success: true, status: response.statusCode, data })
          } catch {
            resolve({ success: true, status: response.statusCode, data: responseData })
          }
        })

        response.on('error', (error) => {
          resolve({ success: false, error: error.message })
        })
      })

      request.on('error', (error) => {
        resolve({ success: false, error: error.message })
      })

      setTimeout(() => {
        request.abort()
        resolve({ success: false, error: '请求超时 (10秒)' })
      }, 10000)

      if (options.body) {
        request.write(options.body)
      }

      request.end()
    } catch (error: any) {
      resolve({ success: false, error: error.message })
    }
  })
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
