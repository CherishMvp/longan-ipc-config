// Electron API 类型定义
export interface DiscoveredDevice {
  ip: string
  uuid: string
  name: string
  manufacturer: string
  xaddrs: string
  type: 'onvif' | 'hikvision' | 'scan'
}

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
  
  // Window Controls (Optional now as we use native frame)
  minimize?: () => void
  toggleMaximize?: () => void
  close?: () => void
  
  // Discovery
  startScan: (options?: any) => Promise<{ success: boolean; error?: string }>
  stopScan: () => Promise<{ success: boolean }>
  onDeviceFound: (callback: (device: DiscoveredDevice) => void) => () => void

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

  // Onvif
  getNetworkSettings: (params: { url: string, username?: string, password?: string }) => Promise<{ success: boolean; token?: string; config?: any; error?: string }>
  setNetworkSettings: (params: { url: string, token: string, config: any, username?: string, password?: string }) => Promise<{ success: boolean; error?: string }>

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
