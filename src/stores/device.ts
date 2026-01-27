import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Device {
  id: number
  name: string
  ip: string
  authId: string
  status: 'online' | 'offline' | 'unknown'
}

export interface GlobalConfig {
  username: string
  password: string
  clientId: string
  uploadPath: string
  baudRate: number
  enable: number
}

export interface LogEntry {
  id: number
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
  time: string
  data?: any
}

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])
  const logs = ref<LogEntry[]>([])
  
  const globalConfig = ref<GlobalConfig>({
    username: 'admin',
    password: 'admin123',
    clientId: 'e5cd7e4891bf95d1d19206ce24a7b32e',
    uploadPath: 'http://192.168.0.38:8080/endWebApi/acceptTransparentData',
    baudRate: 115200,
    enable: 1
  })

  const deviceCount = computed(() => devices.value.length)
  const onlineCount = computed(() => devices.value.filter(d => d.status === 'online').length)

  // 初始化加载
  const init = async () => {
    if (window.electronAPI) {
      try {
        // Load devices
        const dbDevices = await window.electronAPI.getDevices()
        devices.value = dbDevices.map(d => ({
          ...d,
          status: d.status || 'unknown' // Ensure status exists
        }))

        // Load logs
        const dbLogs = await window.electronAPI.getLogs(100)
        logs.value = dbLogs

        // Load config
        const dbConfig = await window.electronAPI.getConfig()
        if (dbConfig && Object.keys(dbConfig).length > 0) {
          globalConfig.value = { ...globalConfig.value, ...dbConfig }
        }
      } catch (e) {
        console.error('Failed to initialize from DB:', e)
      }
    }
  }

  const saveConfig = async () => {
    if (window.electronAPI) {
      await window.electronAPI.saveConfig(globalConfig.value)
    }
  }

  // 添加设备
  const addDevice = async (device: Omit<Device, 'id' | 'status'>) => {
    if (devices.value.find(d => d.ip === device.ip)) {
      throw new Error(`设备IP ${device.ip} 已存在`)
    }
    
    const newDevice = {
      ...device,
      status: 'unknown'
    }

    if (window.electronAPI) {
      const res = await window.electronAPI.addDevice(newDevice)
      if (res.success && res.id) {
        devices.value.unshift({ ...newDevice, id: res.id, status: 'unknown' } as Device)
      } else {
        throw new Error(res.error || 'Failed to add device to DB')
      }
    } else {
      // Fallback for dev without electron (though we use ipc now)
      devices.value.push({ ...newDevice, id: Date.now(), status: 'unknown' } as Device)
    }
  }

  // 删除设备
  const removeDevice = async (id: number) => {
    if (window.electronAPI) {
      await window.electronAPI.removeDevice(id)
    }
    devices.value = devices.value.filter(d => d.id !== id)
  }

  // 清空设备
  const clearDevices = async () => {
    // Ideally we'd have a clearDevices API, but for now we loop or add one
    // Let's just clear local state for now as mass delete API wasn't added
    // To be safe, we should loop delete
    for (const d of devices.value) {
      if (window.electronAPI) await window.electronAPI.removeDevice(d.id)
    }
    devices.value = []
  }

  // 更新设备状态
  const updateDeviceStatus = async (id: number, status: Device['status']) => {
    const device = devices.value.find(d => d.id === id)
    if (device) {
      device.status = status
      if (window.electronAPI) {
        await window.electronAPI.updateDeviceStatus(id, status)
      }
    }
  }

  // 更新全局配置
  const updateGlobalConfig = (config: Partial<GlobalConfig>) => {
    globalConfig.value = { ...globalConfig.value, ...config }
    saveConfig()
  }

  // 日志
  const addLog = async (type: LogEntry['type'], message: string, data?: any) => {
    const newLog = {
      type,
      message,
      data,
      time: new Date().toLocaleTimeString()
    }
    
    // Optimistic UI update
    logs.value.push({ ...newLog, id: Date.now() })
    if (logs.value.length > 100) logs.value.shift()

    if (window.electronAPI) {
      await window.electronAPI.addLog(newLog)
    }
  }

  const clearLogs = async () => {
    logs.value = []
    if (window.electronAPI) {
      await window.electronAPI.clearLogs()
    }
  }

  // 导入导出保持不变 (内存操作)
  const exportDevices = () => {
    return JSON.stringify(devices.value, null, 2)
  }

  const importDevices = (jsonStr: string) => {
    const imported = JSON.parse(jsonStr) as Device[]
    if (!Array.isArray(imported)) throw new Error('格式错误')
    let count = 0
    imported.forEach(d => {
      if (d.name && d.ip && d.authId && !devices.value.find(x => x.ip === d.ip)) {
        addDevice(d) // Reuse addDevice to persist
        count++
      }
    })
    return count
  }

  // Start
  init()

  return {
    devices,
    globalConfig,
    logs,
    deviceCount,
    onlineCount,
    addDevice,
    removeDevice,
    clearDevices,
    updateDeviceStatus,
    updateGlobalConfig,
    exportDevices,
    importDevices,
    saveToStorage: saveConfig, // Alias for compatibility
    addLog,
    clearLogs
  }
})
