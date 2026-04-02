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

        // Load config (exclude settings.* keys to avoid pollution)
        const dbConfig = await window.electronAPI.getConfig()
        if (dbConfig && Object.keys(dbConfig).length > 0) {
          if (dbConfig['globalConfig']) {
            globalConfig.value = { ...globalConfig.value, ...dbConfig['globalConfig'] }
          }
        }
      } catch (e) {
        console.error('Failed to initialize from DB:', e)
      }
    }
  }

  const saveConfig = async () => {
    if (window.electronAPI) {
      const configToSave = JSON.parse(JSON.stringify(globalConfig.value))
      await window.electronAPI.saveConfig({
        'globalConfig': configToSave
      })
    }
  }

  // 添加设备
  const addDevice = async (device: Omit<Device, 'id' | 'status'>) => {
    if (devices.value.find(d => d.ip === device.ip)) {
      throw new Error(`设备IP ${device.ip} 已存在`)
    }
    
    // 解包可能的 Proxy 对象
    const deviceData = JSON.parse(JSON.stringify(device))
    const newDeviceData = {
      ...deviceData,
      status: 'unknown'
    }

    if (window.electronAPI) {
      const res = await window.electronAPI.addDevice(newDeviceData)
      if (res.success && res.id) {
        devices.value.unshift({ ...newDeviceData, id: res.id, status: 'unknown' } as Device)
      } else {
        throw new Error(res.error || 'Failed to add device to DB')
      }
    } else {
      // Fallback for dev without electron (though we use ipc now)
      devices.value.push({ ...newDeviceData, id: Date.now(), status: 'unknown' } as Device)
    }
  }

  // 删除设备
  const removeDevice = async (id: number) => {
    if (!id) return
    if (window.electronAPI) {
      await window.electronAPI.removeDevice(id)
    }
    devices.value = devices.value.filter(d => d.id !== id)
  }

  // 清空设备
  const clearDevices = async () => {
    if (window.electronAPI) {
      for (const d of devices.value) {
        await window.electronAPI.removeDevice(d.id)
      }
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
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
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

  // 导出导出保持不变 (内存操作)
  const exportDevices = () => {
    return JSON.stringify(devices.value, null, 2)
  }

  const importDevices = async (jsonStr: string) => {
    let imported: any[]
    try {
      imported = JSON.parse(jsonStr)
    } catch (e) {
      throw new Error('解析 JSON 失败，请检查格式')
    }

    if (!Array.isArray(imported)) throw new Error('格式错误：数据必须是数组')
    
    let count = 0
    // 使用 for...of 确保异步串行执行，避免 ID 冲突
    for (const d of imported) {
      if (d.name && d.ip && d.authId && !devices.value.find(x => x.ip === d.ip)) {
        try {
          await addDevice({
            name: String(d.name),
            ip: String(d.ip),
            authId: String(d.authId)
          })
          count++
        } catch (err) {
          console.warn(`跳过设备 ${d.ip}:`, err)
        }
      }
    }
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
