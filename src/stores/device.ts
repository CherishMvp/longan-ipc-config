import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 设备信息
 * 代表一个 IPC 气体传感器设备
 */
export interface Device {
  id: number
  name: string
  ip: string
  authId: string
  status: 'online' | 'offline' | 'unknown'
}

/**
 * 气体传感器配置
 * 
 * 用于 IPC 气体传感器设备的认证和数据上传配置
 * 
 * 配置项说明：
 * - username/password: HTTP Basic Auth 认证凭据
 * - clientId: 客户端唯一标识
 * - uploadPath: 传感器数据上传的服务器地址
 * - baudRate: 串口波特率（用于 TTL 通信）
 * - enable: 启用状态 (1=启用, 0=禁用)
 * 
 * @see src/api/gas.ts - API 调用实现
 * @see src/views/gas-config/index.vue - 配置页面
 * @see src/views/Layout.vue - 侧边栏显示用户名
 */
export interface GasSensorConfig {
  username: string
  password: string
  clientId: string
  uploadPath: string
  baudRate: number
  enable: number
}

/**
 * 操作日志条目
 */
export interface LogEntry {
  id: number
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
  time: string
  data?: any
}

/**
 * 设备管理 Store
 * 
 * 职责：
 * 1. 管理气体传感器设备列表（增删改查）
 * 2. 记录操作日志
 * 3. 管理气体传感器配置（认证、上传路径等）
 * 
 * 数据持久化：
 * - devices: 存储在 SQLite devices 表
 * - logs: 存储在 SQLite logs 表
 * - gasSensorConfig: 存储在 SQLite config 表 (key: 'globalConfig')
 */
export const useDeviceStore = defineStore('device', () => {
  // ==================== 设备列表 ====================
  const devices = ref<Device[]>([])
  
  // ==================== 操作日志 ====================
  const logs = ref<LogEntry[]>([])
  
  // ==================== 气体传感器配置 ====================
  const gasSensorConfig = ref<GasSensorConfig>({
    username: 'admin',
    password: 'admin123',
    clientId: 'e5cd7e4891bf95d1d19206ce24a7b32e',
    uploadPath: 'http://192.168.0.38:8080/endWebApi/acceptTransparentData',
    baudRate: 115200,
    enable: 1
  })

  // ==================== 计算属性 ====================
  const deviceCount = computed(() => devices.value.length)
  const onlineCount = computed(() => devices.value.filter(d => d.status === 'online').length)

  // ==================== 初始化加载 ====================
  const init = async () => {
    if (window.electronAPI) {
      try {
        // 加载设备列表
        const dbDevices = await window.electronAPI.getDevices()
        devices.value = dbDevices.map(d => ({
          ...d,
          status: d.status || 'unknown'
        }))

        // 加载操作日志
        const dbLogs = await window.electronAPI.getLogs(100)
        logs.value = dbLogs

        // 加载气体传感器配置
        // 注意：DB key 为 'globalConfig'（历史原因，保持向后兼容）
        const dbConfig = await window.electronAPI.getConfig()
        if (dbConfig && Object.keys(dbConfig).length > 0) {
          if (dbConfig['globalConfig']) {
            gasSensorConfig.value = { ...gasSensorConfig.value, ...dbConfig['globalConfig'] }
          }
        }
      } catch (e) {
        console.error('Failed to initialize from DB:', e)
      }
    }
  }

  // ==================== 气体传感器配置持久化 ====================
  const saveConfig = async () => {
    if (window.electronAPI) {
      // 解包 Vue Proxy 对象，避免 IPC 序列化错误
      const configToSave = JSON.parse(JSON.stringify(gasSensorConfig.value))
      await window.electronAPI.saveConfig({
        'globalConfig': configToSave // DB key 保持为 'globalConfig' 以向后兼容
      })
    }
  }

  // ==================== 设备管理 ====================
  
  /**
   * 添加新设备
   * @throws 设备 IP 已存在时抛出错误
   */
  const addDevice = async (device: Omit<Device, 'id' | 'status'>) => {
    if (devices.value.find(d => d.ip === device.ip)) {
      throw new Error(`设备IP ${device.ip} 已存在`)
    }
    
    // 解包 Vue Proxy 对象，避免 IPC 序列化错误
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
      devices.value.push({ ...newDeviceData, id: Date.now(), status: 'unknown' } as Device)
    }
  }

  const removeDevice = async (id: number) => {
    if (!id) return
    if (window.electronAPI) {
      await window.electronAPI.removeDevice(id)
    }
    devices.value = devices.value.filter(d => d.id !== id)
  }

  const clearDevices = async () => {
    if (window.electronAPI) {
      for (const d of devices.value) {
        await window.electronAPI.removeDevice(d.id)
      }
    }
    devices.value = []
  }

  const updateDeviceStatus = async (id: number, status: Device['status']) => {
    const device = devices.value.find(d => d.id === id)
    if (device) {
      device.status = status
      if (window.electronAPI) {
        await window.electronAPI.updateDeviceStatus(id, status)
      }
    }
  }

  /**
   * 更新气体传感器配置
   * 自动触发持久化保存
   */
  const updateGasSensorConfig = (config: Partial<GasSensorConfig>) => {
    gasSensorConfig.value = { ...gasSensorConfig.value, ...config }
    saveConfig()
  }

  // ==================== 日志管理 ====================
  
  /**
   * 添加操作日志
   * @param type 日志类型
   * @param message 日志消息
   * @param data 附加数据（可选，会自动解包 Proxy）
   */
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

  // ==================== 导入导出 ====================
  
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

  // ==================== 初始化 ====================
  init()

  // ==================== 导出 ====================
  return {
    // 状态
    devices,
    gasSensorConfig,
    logs,
    
    // 计算属性
    deviceCount,
    onlineCount,
    
    // 设备管理
    addDevice,
    removeDevice,
    clearDevices,
    updateDeviceStatus,
    
    // 配置管理
    updateGasSensorConfig,
    saveToStorage: saveConfig, // 别名，保持向后兼容
    
    // 日志管理
    addLog,
    clearLogs,
    
    // 导入导出
    exportDevices,
    importDevices
  }
})