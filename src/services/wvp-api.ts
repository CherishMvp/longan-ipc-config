import CryptoJS from 'crypto-js'

export interface WVPDevice {
  deviceId: string
  name: string
  status: 'online' | 'offline'
  channels: WVPChannel[]
}

export interface WVPChannel {
  channelId: string
  name: string
  status: 'online' | 'offline'
}

export interface StreamContent {
  deviceId: string
  channelId: string
  stream: string
  app: string
  flv?: string
  ws_flv?: string
  hls?: string
  fmp4?: string
  rtmp?: string
}

export interface WVPResult<T> {
  code: number
  msg: string
  data: T
}

let loggerInstance: any = null

export function setWVPLogger(logger: any) {
  loggerInstance = logger
}

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  if (loggerInstance) {
    loggerInstance[level]('wvp', message, data)
  }
  console.log(`[WVP][${level.toUpperCase()}] ${message}`, data || '')
}

export class WVPApiService {
  private baseUrl: string
  private token: string = ''
  private tokenExpireTime: number = 0
  private username: string = ''
  private password: string = ''

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    log('info', `WVP API Service 创建`, { baseUrl })
  }

  setToken(token: string): void {
    this.token = token
  }

  async login(username: string, password: string): Promise<string> {
    this.username = username
    this.password = password
    
    log('info', `尝试登录 WVP`, { baseUrl: this.baseUrl, username })
    
    const md5Password = CryptoJS.MD5(password).toString()
    
    try {
      const res = await fetch(
        `${this.baseUrl}/api/user/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(md5Password)}`,
        { method: 'GET' }
      )
      
      if (!res.ok) {
        log('error', `登录失败: HTTP ${res.status}`, { status: res.statusText })
        throw new Error(`Login failed: ${res.statusText}`)
      }
      
      const data: WVPResult<{ accessToken: string }> = await res.json()
      
      if (data.code !== 0) {
        log('error', `登录失败: ${data.msg}`, { code: data.code })
        throw new Error(`Login failed: ${data.msg}`)
      }
      
      this.token = data.data.accessToken
      this.tokenExpireTime = Date.now() + 3600000
      
      log('info', `WVP 登录成功`, { token: this.token.substring(0, 20) + '...' })
      
      return this.token
    } catch (e: any) {
      log('error', `登录异常`, { error: e.message })
      throw e
    }
  }

  getToken(): string {
    return this.token
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (Date.now() > this.tokenExpireTime - 300000) {
      log('warn', `Token 即将过期，刷新中...`)
      await this.login(this.username, this.password)
    }
  }

  private getAuthHeaders(): HeadersInit {
    return {
      'access-token': this.token,
      'Content-Type': 'application/json'
    }
  }

  async getDevices(): Promise<WVPDevice[]> {
    await this.refreshTokenIfNeeded()
    
    log('info', `获取设备列表`)
    
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/device/list`, {
        headers: this.getAuthHeaders()
      })
      
      if (!res.ok) {
        log('error', `获取设备失败: HTTP ${res.status}`)
        throw new Error(`Get devices failed: ${res.statusText}`)
      }
      
      const data = await res.json()
      const deviceList = data.DeviceList || data.data?.list || []
      
      const devices = deviceList.map((device: any) => ({
        deviceId: device.ID || device.deviceId,
        name: device.Name || device.name || 'Unknown',
        status: device.Online || device.online ? 'online' : 'offline',
        channels: []
      }))
      
      log('info', `获取设备成功`, { count: devices.length })
      
      return devices
    } catch (e: any) {
      log('error', `获取设备异常`, { error: e.message })
      throw e
    }
  }

  async getChannels(deviceId: string): Promise<WVPChannel[]> {
    await this.refreshTokenIfNeeded()
    
    log('info', `获取通道列表`, { deviceId })
    
    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/device/channellist?serial=${encodeURIComponent(deviceId)}`,
        { headers: this.getAuthHeaders() }
      )
      
      if (!res.ok) {
        log('error', `获取通道失败: HTTP ${res.status}`, { deviceId })
        throw new Error(`Get channels failed: ${res.statusText}`)
      }
      
      const data = await res.json()
      const channelList = data.ChannelList || data.data?.list || []
      
      const channels = channelList.map((channel: any) => ({
        channelId: channel.ID || channel.channelId,
        name: channel.Name || channel.name || 'Unknown',
        status: channel.Status === 'ON' || channel.status === 'ON' ? 'online' : 'offline'
      }))
      
      log('info', `获取通道成功`, { deviceId, count: channels.length })
      
      return channels
    } catch (e: any) {
      log('error', `获取通道异常`, { deviceId, error: e.message })
      throw e
    }
  }

  async startPlay(
    deviceId: string, 
    channelId: string
  ): Promise<StreamContent> {
    await this.refreshTokenIfNeeded()
    
    log('info', `开始点播`, { deviceId, channelId })
    
    try {
      const res = await fetch(
        `${this.baseUrl}/api/play/start/${deviceId}/${channelId}`,
        { headers: this.getAuthHeaders() }
      )
      
      if (!res.ok) {
        log('error', `点播失败: HTTP ${res.status}`, { deviceId, channelId })
        throw new Error(`Play start failed: ${res.statusText}`)
      }
      
      const data: WVPResult<StreamContent> = await res.json()
      
      if (data.code !== 0) {
        log('error', `点播失败: ${data.msg}`, { deviceId, channelId, code: data.code })
        throw new Error(`Play start failed: ${data.msg}`)
      }
      
      log('info', `点播成功`, {
        deviceId,
        channelId,
        flv: data.data.flv,
        ws_flv: data.data.ws_flv,
        hls: data.data.hls
      })
      
      return data.data
    } catch (e: any) {
      log('error', `点播异常`, { deviceId, channelId, error: e.message })
      throw e
    }
  }

  async stopPlay(deviceId: string, channelId: string): Promise<void> {
    await this.refreshTokenIfNeeded()
    
    log('info', `停止点播`, { deviceId, channelId })
    
    await fetch(
      `${this.baseUrl}/api/play/stop/${deviceId}/${channelId}`,
      { headers: this.getAuthHeaders() }
    )
  }

  async ptzControl(
    deviceId: string, 
    channelId: string, 
    command: string,
    speed: number = 50
  ): Promise<void> {
    log('info', `PTZ 控制`, { deviceId, channelId, command, speed })
    
    await fetch(`${this.baseUrl}/api/v1/device/ptz`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ deviceId, channelId, command, speed })
    })
  }
}
