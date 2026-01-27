// Electron API 类型定义
export interface ElectronAPI {
  httpRequest: (options: {
    url: string
    method: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: string
  }) => Promise<{
    success: boolean
    status?: number
    data?: any
    error?: string
  }>
  platform: string
  versions: {
    node: string
    electron: string
    chrome: string
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
