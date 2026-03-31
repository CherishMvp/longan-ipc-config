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
  streamType?: 'H264' | 'H265'
}

export type Protocol = 'http-flv' | 'ws-flv' | 'webrtc'

export interface PlayResponse {
  url: string
  type: Protocol
  deviceId: string
  channelId: string
}

export class WVPApiService {
  private baseUrl: string
  public token: string = ''

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async login(username: string, password: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    
    if (!res.ok) throw new Error(`Login failed: ${res.statusText}`)
    
    const data = await res.json()
    this.token = data.data?.token || data.token || ''
    if (!this.token) throw new Error('No token received')
    return this.token
  }

  private getAuthHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    }
  }

  async getDevices(): Promise<WVPDevice[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/device/list`, {
      headers: this.getAuthHeaders()
    })
    
    if (!res.ok) throw new Error(`Get devices failed: ${res.statusText}`)
    
    const data = await res.json()
    return data.data?.list || data.list || []
  }

  async getChannels(deviceId: string): Promise<WVPChannel[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/device/channels?deviceId=${deviceId}`, {
      headers: this.getAuthHeaders()
    })
    
    if (!res.ok) throw new Error(`Get channels failed: ${res.statusText}`)
    
    const data = await res.json()
    return data.data?.list || data.list || []
  }

  async getPlayUrl(
    deviceId: string, 
    channelId: string, 
    protocol: Protocol = 'http-flv'
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/v1/play/${deviceId}/${channelId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ protocol })
    })
    
    if (!res.ok) throw new Error(`Get play URL failed: ${res.statusText}`)
    
    const data = await res.json()
    return data.data?.url || data.url
  }

  async stopPlay(deviceId: string, channelId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/play/stop`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ deviceId, channelId })
    })
  }

  async ptzControl(
    deviceId: string, 
    channelId: string, 
    command: string,
    speed: number = 50
  ): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/ptz/${deviceId}/${channelId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ command, speed })
    })
  }
}
