import { app, BrowserWindow, ipcMain, net } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null

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
    titleBarStyle: 'hiddenInset',
    frame: true,
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 开发环境加载vite服务
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// IPC: HTTP请求代理 - 解决跨域问题
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

      // 设置请求头
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

      // 设置超时
      setTimeout(() => {
        request.abort()
        resolve({ success: false, error: '请求超时 (10秒)' })
      }, 10000)

      // 发送请求体
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
