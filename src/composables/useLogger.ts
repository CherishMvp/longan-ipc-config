import { ref } from 'vue'

export type LogType = 'player' | 'wvp' | 'app' | 'error'
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  type: LogType
  level: LogLevel
  message: string
  data?: any
  time: string
}

const logs = ref<LogEntry[]>([])
const maxLogs = 500

export function useLogger() {
  async function log(type: LogType, level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      id: Date.now(),
      type,
      level,
      message,
      data,
      time: new Date().toLocaleTimeString()
    }
    
    logs.value.unshift(entry)
    if (logs.value.length > maxLogs) {
      logs.value.pop()
    }
    
    if (window.electronAPI) {
      try {
        await window.electronAPI.addLog({
          type: `${type}:${level}`,
          message,
          data: data ? JSON.stringify(data) : null
        })
      } catch (e) {
        console.error('Failed to save log to DB:', e)
      }
    }
    
    console.log(`[${type.toUpperCase()}][${level.toUpperCase()}] ${message}`, data || '')
  }
  
  function info(type: LogType, message: string, data?: any) {
    log(type, 'info', message, data)
  }
  
  function warn(type: LogType, message: string, data?: any) {
    log(type, 'warn', message, data)
  }
  
  function error(type: LogType, message: string, data?: any) {
    log(type, 'error', message, data)
  }
  
  async function loadFromDB() {
    if (!window.electronAPI) return
    
    try {
      const dbLogs = await window.electronAPI.getLogs(100)
      logs.value = dbLogs.map(l => {
        const [type, level] = (l.type || 'app:info').split(':') as [LogType, LogLevel]
        return {
          id: l.id,
          type,
          level,
          message: l.message,
          data: l.data,
          time: l.time
        }
      })
    } catch (e) {
      console.error('Failed to load logs from DB:', e)
    }
  }
  
  async function clearLogs() {
    logs.value = []
    if (window.electronAPI) {
      await window.electronAPI.clearLogs()
    }
  }
  
  return {
    logs,
    log,
    info,
    warn,
    error,
    loadFromDB,
    clearLogs
  }
}