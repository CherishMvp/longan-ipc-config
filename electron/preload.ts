import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // HTTP
  httpRequest: (options: any) => ipcRenderer.invoke('http-request', options),

  // Window
  minimize: () => ipcRenderer.send('minimize-window'),
  toggleMaximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),

  // Database - Devices
  getDevices: () => ipcRenderer.invoke('db-get-devices'),
  addDevice: (device: any) => ipcRenderer.invoke('db-add-device', device),
  removeDevice: (id: number) => ipcRenderer.invoke('db-remove-device', id),
  updateDeviceStatus: (id: number, status: string) => ipcRenderer.invoke('db-update-device-status', { id, status }),

  // Database - Logs
  getLogs: (limit?: number) => ipcRenderer.invoke('db-get-logs', limit),
  addLog: (log: any) => ipcRenderer.invoke('db-add-log', log),
  clearLogs: () => ipcRenderer.invoke('db-clear-logs'),

  // Database - Config
  saveConfig: (config: any) => ipcRenderer.invoke('db-save-config', config),
  getConfig: () => ipcRenderer.invoke('db-get-config'),

  platform: process.platform,
  versions: process.versions
})
