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

export class WVPApiService {
  private baseUrl: string
  private token: string = ''
  private tokenExpireTime: number = 0
  private username: string = ''
  private password: string = ''

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setToken(token: string): void {
    this.token = token
  }

  async login(username: string, password: string): Promise<string> {
    this.username = username
    this.password = password
    
    const md5Password = CryptoJS.MD5(password).toString()
    
    const res = await fetch(
      `${this.baseUrl}/api/user/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(md5Password)}`,
      { method: 'GET' }
    )
    
    if (!res.ok) {
      throw new Error(`Login failed: ${res.statusText}`)
    }
    
    const data: WVPResult<{ accessToken: string }> = await res.json()
    
    if (data.code !== 0) {
      throw new Error(`Login failed: ${data.msg}`)
    }
    
    this.token = data.data.accessToken
    this.tokenExpireTime = Date.now() + 3600000 // 1小时
    
    return this.token
  }

  getToken(): string {
    return this.token
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (Date.now() > this.tokenExpireTime - 300000) { // 5分钟前刷新
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
    
    const res = await fetch(`${this.baseUrl}/api/v1/device/list`, {
      headers: this.getAuthHeaders()
    })
    
    if (!res.ok) {
      throw new Error(`Get devices failed: ${res.statusText}`)
    }
    
    const data = await res.json()
    const deviceList = data.DeviceList || data.data?.list || []
    
    return deviceList.map((device: any) => ({
      deviceId: device.ID || device.deviceId,
      name: device.Name || device.name || 'Unknown',
      status: device.Online ? 'online' : 'offline',
      channels: []
    }))
  }

  async getChannels(deviceId: string): Promise<WVPChannel[]> {
    await this.refreshTokenIfNeeded()
    
    const res = await fetch(
      `${this.baseUrl}/api/v1/device/channellist?serial=${encodeURIComponent(deviceId)}`,
      { headers: this.getAuthHeaders() }
    )
    
    if (!res.ok) {
      throw new Error(`Get channels failed: ${res.statusText}`)
    }
    
    const data = await res.json()
    const channelList = data.ChannelList || data.data?.list || []
    
    return channelList.map((channel: any) => ({
      channelId: channel.ID || channel.channelId,
      name: channel.Name || channel.name || 'Unknown',
      status: channel.Online ? 'online' : 'offline'
    }))
  }

  /**
   * 开始点播（使用正确的 WVP API）
   * 这是关键的修正：使用 /api/play/start 而不是 /api/media/getPlayUrl
   */
  async startPlay(
    deviceId: string, 
    channelId: string
  ): Promise<StreamContent> {
    await this.refreshTokenIfNeeded()
    
    const res = await fetch(
      `${this.baseUrl}/api/play/start/${deviceId}/${channelId}`,
      { headers: this.getAuthHeaders() }
    )
    
    if (!res.ok) {
      throw new Error(`Play start failed: ${res.statusText}`)
    }
    
    const data: WVPResult<StreamContent> = await res.json()
    
    if (data.code !== 0) {
      throw new Error(`Play start failed: ${data.msg}`)
    }
    
    return data.data
  }

  /**
   * 停止点播（使用正确的 WVP API）
   */
  async stopPlay(deviceId: string, channelId: string): Promise<void> {
    await this.refreshTokenIfNeeded()
    
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
    // 需要根据实际 API 调整
    await fetch(`${this.baseUrl}/api/v1/device/ptz`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ deviceId, channelId, command, speed })
    })
  }
}
