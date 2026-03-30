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
  getDeviceInformation: (params: { url: string, username?: string, password?: string }) => Promise<{ success: boolean; info?: any; error?: string }>
  getNetworkProtocols: (params: { url: string, username?: string, password?: string }) => Promise<{ success: boolean; protocols?: { http: number, rtsp: number }; error?: string }>
  setUser: (params: { url: string, targetUsername: string, newPassword: string, username?: string, password?: string }) => Promise<{ success: boolean; error?: string }>
  getTime: (params: { url: string, username?: string, password?: string }) => Promise<{ success: boolean; type?: string; displayTime?: string; error?: string }>
  setTime: (params: { url: string, username?: string, password?: string }) => Promise<{ success: boolean; error?: string }>
  reboot: (params: { url: string, username?: string, password?: string }) => Promise<{ success: boolean; message?: string; error?: string }>
  getSnapshot: (params: { url: string, username?: string, password?: string }) => Promise<{ success: boolean; dataUrl?: string; error?: string }>
  getStreamUri: (params: { url: string, protocol?: string, username?: string, password?: string }) => Promise<{ success: boolean; uri?: string; encoding?: string; error?: string }>

  // WebRTC
  webrtcPlay: (params: { rtspUrl: string }) => Promise<{ success: boolean; error?: string }>
  webrtcAnswer: (params: { sdp: string, type: string }) => Promise<{ success: boolean }>
  webrtcAddCandidate: (params: { candidate: string, mid: string }) => Promise<{ success: boolean }>
  webrtcStop: () => Promise<{ success: boolean }>
  onWebRTCOffer: (callback: (data: { sdp: string, type: string }) => void) => () => void
  onWebRTCCandidate: (callback: (data: { candidate: string, mid: string }) => void) => () => void

  // Updater
  checkForUpdates: () => Promise<{ success: boolean; result?: any; error?: string }>
  quitAndInstall: () => Promise<void>
  onUpdaterMessage: (callback: (msg: { type: string, msg: string, info?: any }) => void) => void
  onUpdaterProgress: (callback: (progress: any) => void) => void

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
