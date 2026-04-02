import type { GasSensorConfig } from '@/stores/device'

// 生成Basic Auth
const getBasicAuth = (username: string, password: string): string => {
  return btoa(`${username}:${password}`)
}

// 判断是否在Electron环境
const isElectron = (): boolean => {
  return !!window.electronAPI
}

// HTTP请求封装
const httpRequest = async (options: {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}): Promise<any> => {
  if (isElectron()) {
    // Electron环境：使用主进程代理请求
    const result = await window.electronAPI!.httpRequest(options)
    if (!result.success) {
      throw new Error(result.error || '请求失败')
    }
    return result.data
  } else {
    // 浏览器环境：直接fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('请求超时 (10秒)')
      }
      throw error
    }
  }
}

// 获取气体配置
export const getGasConfig = async (ip: string, config: GasSensorConfig): Promise<any> => {
  const auth = getBasicAuth(config.username, config.password)
  return httpRequest({
    url: `http://${ip}/CGI/State/GetTTLInfo.cgi`,
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Clientid': config.clientId
    }
  })
}

// 设置气体配置
export const setGasConfig = async (
  ip: string,
  authId: string,
  config: GasSensorConfig
): Promise<any> => {
  const auth = getBasicAuth(config.username, config.password)
  const body = {
    AuthID: authId,
    BaudRate: config.baudRate,
    Enable: config.enable,
    UploadPath: config.uploadPath
  }

  return httpRequest({
    url: `http://${ip}/CGI/State/SetTTLInfo.cgi`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Clientid': config.clientId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}
