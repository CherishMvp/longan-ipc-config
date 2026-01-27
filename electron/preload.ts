import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // HTTP请求代理 - 无跨域限制
  httpRequest: (options: {
    url: string
    method: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: string
  }) => ipcRenderer.invoke('http-request', options),

  // 平台信息
  platform: process.platform,
  
  // 版本信息
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
})
