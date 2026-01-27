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
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  
  // Database API
  getDevices: () => Promise<any[]>
  addDevice: (device: any) => Promise<{ success: boolean; id?: number; error?: string }>
  removeDevice: (id: number) => Promise<{ success: boolean }>
  updateDeviceStatus: (id: number, status: string) => Promise<{ success: boolean }>
  
  getLogs: (limit?: number) => Promise<any[]>
  addLog: (log: any) => Promise<{ success: boolean }>
  clearLogs: () => Promise<{ success: boolean }>
  
  saveConfig: (config: any) => Promise<{ success: boolean }>
  getConfig: () => Promise<Record<string, any>>

  platform: string
  versions: {
    node: string
    electron: string
    chrome: string
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
