import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // HTTP
  httpRequest: (options: any) => ipcRenderer.invoke('http-request', options),
  
  // Memory Stats
  getMemoryUsage: () => ipcRenderer.invoke('get-memory-usage'),

  // Discovery
  startScan: (options?: any) => ipcRenderer.invoke('start-scan', options),
  stopScan: () => ipcRenderer.invoke('stop-scan'),
  onDeviceFound: (callback: (device: any) => void) => {
    // 监听主进程的 discovery-device-found 事件
    const subscription = (_event: any, device: any) => callback(device)
    ipcRenderer.on('discovery-device-found', subscription)
    // 返回清理函数
    return () => ipcRenderer.removeListener('discovery-device-found', subscription)
  },

  // Database
  getDevices: () => ipcRenderer.invoke('db-get-devices'),
  addDevice: (device: any) => ipcRenderer.invoke('db-add-device', device),
  removeDevice: (id: number) => ipcRenderer.invoke('db-remove-device', id),
  updateDeviceStatus: (id: number, status: string) => ipcRenderer.invoke('db-update-device-status', { id, status }),

  getLogs: (limit?: number) => ipcRenderer.invoke('db-get-logs', limit),
  addLog: (log: any) => ipcRenderer.invoke('db-add-log', log),
  clearLogs: () => ipcRenderer.invoke('db-clear-logs'),

  saveConfig: (config: any) => ipcRenderer.invoke('db-save-config', config),
  getConfig: () => ipcRenderer.invoke('db-get-config'),

  // Onvif
  getNetworkSettings: (params: any) => ipcRenderer.invoke('onvif-get-network', params),
  setNetworkSettings: (params: any) => ipcRenderer.invoke('onvif-set-network', params),
  getDeviceInformation: (params: any) => ipcRenderer.invoke('onvif-get-device-info', params),
  getNetworkProtocols: (params: any) => ipcRenderer.invoke('onvif-get-protocols', params),
  setUser: (params: any) => ipcRenderer.invoke('onvif-set-user', params),
  getTime: (params: any) => ipcRenderer.invoke('onvif-get-time', params),
  setTime: (params: any) => ipcRenderer.invoke('onvif-set-time', params),
  reboot: (params: any) => ipcRenderer.invoke('onvif-reboot', params),
  getSnapshot: (params: any) => ipcRenderer.invoke('onvif-get-snapshot', params),
  getStreamUri: (params: any) => ipcRenderer.invoke('onvif-get-stream-uri', params),

  // WebRTC
  webrtcPlay: (params: any) => ipcRenderer.invoke('webrtc-play', params),
  webrtcAnswer: (params: any) => ipcRenderer.invoke('webrtc-answer', params),
  webrtcAddCandidate: (params: any) => ipcRenderer.invoke('webrtc-add-candidate', params),
  webrtcStop: () => ipcRenderer.invoke('webrtc-stop'),
  onWebRTCOffer: (callback: any) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('webrtc-offer', subscription)
    return () => ipcRenderer.removeListener('webrtc-offer', subscription)
  },
  onWebRTCCandidate: (callback: any) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('webrtc-candidate', subscription)
    return () => ipcRenderer.removeListener('webrtc-candidate', subscription)
  },

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdaterMessage: (callback: any) => ipcRenderer.on('updater-message', (_event, value) => callback(value)),
  onUpdaterProgress: (callback: any) => ipcRenderer.on('updater-progress', (_event, value) => callback(value)),

  platform: process.platform,
  versions: process.versions
})
