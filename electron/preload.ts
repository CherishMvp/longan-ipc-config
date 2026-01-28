import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // HTTP
  httpRequest: (options: any) => ipcRenderer.invoke('http-request', options),

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

  platform: process.platform,
  versions: process.versions
})
