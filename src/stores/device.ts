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

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])
  
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

  // 从localStorage加载
  const loadFromStorage = () => {
    const savedDevices = localStorage.getItem('ipc_devices')
    if (savedDevices) {
      devices.value = JSON.parse(savedDevices)
    }
    const savedConfig = localStorage.getItem('ipc_global_config')
    if (savedConfig) {
      globalConfig.value = { ...globalConfig.value, ...JSON.parse(savedConfig) }
    }
  }

  // 保存到localStorage
  const saveToStorage = () => {
    localStorage.setItem('ipc_devices', JSON.stringify(devices.value))
    localStorage.setItem('ipc_global_config', JSON.stringify(globalConfig.value))
  }

  // 添加设备
  const addDevice = (device: Omit<Device, 'id' | 'status'>) => {
    if (devices.value.find(d => d.ip === device.ip)) {
      throw new Error(`设备IP ${device.ip} 已存在`)
    }
    devices.value.push({
      ...device,
      id: Date.now(),
      status: 'unknown'
    })
    saveToStorage()
  }

  // 删除设备
  const removeDevice = (id: number) => {
    devices.value = devices.value.filter(d => d.id !== id)
    saveToStorage()
  }

  // 清空设备
  const clearDevices = () => {
    devices.value = []
    saveToStorage()
  }

  // 更新设备状态
  const updateDeviceStatus = (id: number, status: Device['status']) => {
    const device = devices.value.find(d => d.id === id)
    if (device) {
      device.status = status
      saveToStorage()
    }
  }

  // 更新全局配置
  const updateGlobalConfig = (config: Partial<GlobalConfig>) => {
    globalConfig.value = { ...globalConfig.value, ...config }
    saveToStorage()
  }

  // 导出设备
  const exportDevices = () => {
    return JSON.stringify(devices.value, null, 2)
  }

  // 导入设备
  const importDevices = (jsonStr: string) => {
    const imported = JSON.parse(jsonStr) as Device[]
    if (!Array.isArray(imported)) {
      throw new Error('格式错误')
    }
    let addedCount = 0
    imported.forEach(d => {
      if (d.name && d.ip && d.authId && !devices.value.find(x => x.ip === d.ip)) {
        devices.value.push({
          id: Date.now() + Math.random(),
          name: d.name,
          ip: d.ip,
          authId: d.authId,
          status: 'unknown'
        })
        addedCount++
      }
    })
    saveToStorage()
    return addedCount
  }

  // 初始化
  loadFromStorage()

  return {
    devices,
    globalConfig,
    deviceCount,
    onlineCount,
    addDevice,
    removeDevice,
    clearDevices,
    updateDeviceStatus,
    updateGlobalConfig,
    exportDevices,
    importDevices,
    saveToStorage
  }
})
