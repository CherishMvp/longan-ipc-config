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
    // WVP 需要 MD5 加密密码 (32 位小写)
    const md5Password = CryptoJS.MD5(password).toString()
    
    // GET 请求到 /api/user/login，参数通过 query 传递
    const res = await fetch(`${this.baseUrl}/api/user/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(md5Password)}`, {
      method: 'GET'
    })
    
    if (!res.ok) throw new Error(`Login failed: ${res.statusText}`)
    
    const data = await res.json()
    // WVP 返回格式：{ code: 0, data: { accessToken: 'xxx', ... } }
    this.token = data.data?.accessToken || data.data?.token || data.token || ''
    if (!this.token) throw new Error('No token received')
    return this.token
  }

  private getAuthHeaders(): HeadersInit {
    return {
      'access-token': this.token,
      'Content-Type': 'application/json'
    }
  }

  async getDevices(): Promise<WVPDevice[]> {
    // GET /api/v1/device/list
    const res = await fetch(`${this.baseUrl}/api/v1/device/list`, {
      headers: this.getAuthHeaders()
    })
    
    if (!res.ok) throw new Error(`Get devices failed: ${res.statusText}`)
    
    const data = await res.json()
    // WVP 返回格式：{ DeviceCount: 0, DeviceList: [...] }
    const deviceList = data.DeviceList || data.data?.list || data.list || []
    
    // 转换为 WVPDevice 格式
    return deviceList.map((device: any) => ({
      deviceId: device.ID || device.deviceId,
      name: device.Name || device.name || 'Unknown',
      status: device.Online ? 'online' : 'offline',
      channels: [] // 需要单独获取
    }))
  }

  async getChannels(deviceId: string): Promise<WVPChannel[]> {
    // GET /api/v1/device/channellist?serial={deviceId}
    const res = await fetch(`${this.baseUrl}/api/v1/device/channellist?serial=${encodeURIComponent(deviceId)}`, {
      headers: this.getAuthHeaders()
    })
    
    if (!res.ok) throw new Error(`Get channels failed: ${res.statusText}`)
    
    const data = await res.json()
    // WVP 返回格式：{ ChannelCount: 0, ChannelList: [...] }
    const channelList = data.ChannelList || data.data?.list || data.list || []
    
    return channelList.map((channel: any) => ({
      channelId: channel.ID || channel.channelId,
      name: channel.Name || channel.name || 'Unknown',
      status: channel.Online ? 'online' : 'offline',
      streamType: channel.StreamType || 'H264'
    }))
  }

  async getPlayUrl(
    deviceId: string, 
    channelId: string, 
    _protocol: Protocol = 'http-flv'
  ): Promise<string> {
    // 使用 bus/localMedia/playMediaBase 接口
    const sn = `${deviceId}:${channelId}`
    const res = await fetch(`${this.baseUrl}/bus/localMedia/playMediaBase?sn=${encodeURIComponent(sn)}&fileId=&fileUrl=`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })
    
    if (!res.ok) throw new Error(`Get play URL failed: ${res.statusText}`)
    
    const data = await res.json()
    // 需要从返回数据中提取播放地址
    return data.data?.url || data.data?.playUrl || ''
  }

  async stopPlay(deviceId: string, channelId: string): Promise<void> {
    await fetch(`${this.baseUrl}/bus/localMedia/stopMedia/${deviceId}_${channelId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders()
    })
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
