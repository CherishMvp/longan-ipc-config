import { app, BrowserWindow, ipcMain, net, shell } from 'electron'
import { join } from 'path'
import { initDB } from './db'
import { startDiscovery, stopDiscovery } from './discovery'
import { 
  getNetworkSettings, 
  setNetworkSettings, 
  getDeviceInformation, 
  systemReboot, 
  getNetworkProtocols, 
  setUser,
  getSystemDateAndTime,
  setSystemDateAndTime,
  getSnapshotUri,
  fetchSnapshot,
  getStreamUri
} from './onvif'
import { initUpdater } from './updater'
import { StreamService } from './StreamService'

let mainWindow: BrowserWindow | null = null
const streamService = new StreamService()
const appStartTime = Date.now()  // 应用启动时间，用于 CPU 计算

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
    frame: true,
    icon: join(__dirname, '../public/icon.png'),
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    // Initialize Updater
    if (mainWindow) initUpdater(mainWindow)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
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

// Discovery IPC
ipcMain.handle('start-scan', (_event, options) => {
  if (mainWindow) {
    startDiscovery(mainWindow, options)
    return { success: true }
  }
  return { success: false, error: 'Main window not found' }
});

ipcMain.handle('stop-scan', () => {
  stopDiscovery()
  return { success: true }
});

// Database IPC
ipcMain.handle('db-get-devices', () => {
  return db.prepare('SELECT * FROM devices ORDER BY created_at DESC').all()
});

ipcMain.handle('db-add-device', (_event, device) => {
  try {
    const stmt = db.prepare('INSERT INTO devices (name, ip, authId, status) VALUES (@name, @ip, @authId, @status)')
    const info = stmt.run(device)
    return { success: true, id: info.lastInsertRowid }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('db-remove-device', (_event, id) => {
  const stmt = db.prepare('DELETE FROM devices WHERE id = ?')
  stmt.run(id)
  return { success: true }
});

ipcMain.handle('db-update-device-status', (_event, { id, status }) => {
  const stmt = db.prepare('UPDATE devices SET status = ? WHERE id = ?')
  stmt.run(status, id)
  return { success: true }
});

ipcMain.handle('db-get-logs', (_event, limit = 100) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT ?').all(limit)
  return logs.map((log: any) => ({
    ...log,
    data: log.data ? JSON.parse(log.data) : null
  }))
});

ipcMain.handle('db-add-log', (_event, log) => {
  const stmt = db.prepare('INSERT INTO logs (type, message, data) VALUES (@type, @message, @data)')
  stmt.run({
    ...log,
    data: log.data ? JSON.stringify(log.data) : null
  })
  return { success: true }
});

ipcMain.handle('db-clear-logs', () => {
  db.prepare('DELETE FROM logs').run()
  return { success: true }
});

ipcMain.handle('db-save-config', (_event, config) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
  const run = db.transaction((conf) => {
    for (const [key, value] of Object.entries(conf)) {
      stmt.run(key, JSON.stringify(value))
    }
  })
  run(config)
  return { success: true }
});

ipcMain.handle('db-get-config', () => {
  const rows = db.prepare('SELECT key, value FROM config').all() as {key: string, value: string}[]
  const config: Record<string, any> = {}
  for (const row of rows) {
    config[row.key] = JSON.parse(row.value)
  }
  return config
});

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
        response.on('data', (chunk) => { responseData += chunk.toString() })
        response.on('end', () => {
          try {
            const data = JSON.parse(responseData)
            resolve({ success: true, status: response.statusCode, data })
          } catch {
            resolve({ success: true, status: response.statusCode, data: responseData })
          }
        })
      })
      request.on('error', (error) => { resolve({ success: false, error: error.message }) })
      setTimeout(() => { request.abort(); resolve({ success: false, error: '请求超时' }) }, 10000)
      if (options.body) request.write(options.body)
      request.end()
    } catch (error: any) {
      resolve({ success: false, error: error.message })
    }
  })
});

// Onvif IPC
ipcMain.handle('onvif-get-network', async (_event, { url, username, password }) => {
  try {
    const result = await getNetworkSettings(url, username, password)
    return { success: true, ...result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-set-network', async (_event, { url, token, config, username, password }) => {
  try {
    await setNetworkSettings(url, token, config, username, password)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-get-device-info', async (_event, { url, username, password }) => {
  try {
    const result = await getDeviceInformation(url, username, password)
    return { success: true, info: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-reboot', async (_event, { url, username, password }) => {
  try {
    const msg = await systemReboot(url, username, password)
    return { success: true, message: msg }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-get-protocols', async (_event, { url, username, password }) => {
  try {
    const result = await getNetworkProtocols(url, username, password)
    return { success: true, protocols: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-set-user', async (_event, { url, targetUsername, newPassword, username, password }) => {
  try {
    await setUser(url, targetUsername, newPassword, username, password)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-get-time', async (_event, { url, username, password }) => {
  try {
    const result = await getSystemDateAndTime(url, username, password)
    return { success: true, ...result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-set-time', async (_event, { url, username, password }) => {
  try {
    await setSystemDateAndTime(url, username, password)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-get-snapshot', async (_event, { url, username, password }) => {
  try {
    const uri = await getSnapshotUri(url, username, password)
    const dataUrl = await fetchSnapshot(uri, username, password)
    return { success: true, dataUrl }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('onvif-get-stream-uri', async (_event, { url, protocol, username, password }) => {
  try {
    const result = await getStreamUri(url, protocol, username, password)
    return { success: true, ...result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
});

// Memory Stats
ipcMain.handle('get-memory-usage', async () => {
  const memoryUsage = process.memoryUsage()
  return {
    rss: memoryUsage.rss,           // Resident Set Size - 总物理内存
    heapTotal: memoryUsage.heapTotal, // V8 堆总量
    heapUsed: memoryUsage.heapUsed,   // V8 堆使用量
    external: memoryUsage.external,   // C++ 对象内存
    arrayBuffers: memoryUsage.arrayBuffers || 0
  }
})

// System Stats (内存 + CPU + GPU)
ipcMain.handle('get-system-stats', async () => {
  const memoryUsage = process.memoryUsage()
  
  // CPU 占用计算
  const cpuUsage = process.cpuUsage()
  const cpuPercent = Math.round(
    ((cpuUsage.user + cpuUsage.system) / 1000000 / (Date.now() - appStartTime) * 100)
  )
  
  // GPU 内存（Electron 不直接提供，使用 appMetrics 估算）
  let gpuMemory = 0
  try {
    const appMetrics = app.getAppMetrics()
    const gpuProcess = appMetrics.find(p => p.type === 'GPU')
    if (gpuProcess && gpuProcess.memory) {
      gpuMemory = gpuProcess.memory.workingSetSize || 0
    }
  } catch (error) {
    // GPU 进程可能不存在
  }
  
  return {
    mainMemory: memoryUsage.rss,     // 主进程内存
    heapUsed: memoryUsage.heapUsed,  // 堆使用
    gpuMemory: gpuMemory,            // GPU 内存
    cpuPercent: cpuPercent,          // CPU 占用百分比
    timestamp: Date.now()
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { 
    streamService.stopAll();
    if (process.platform !== "darwin") app.quit();
});
