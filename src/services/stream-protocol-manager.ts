import { WVPApiService, Protocol } from './wvp-api'

export class StreamProtocolManager {
  private protocols: Protocol[] = ['http-flv', 'ws-flv', 'webrtc']
  private currentProtocolIndex = 0
  private wvpApi: WVPApiService

  constructor(wvpApi: WVPApiService) {
    this.wvpApi = wvpApi
  }

  async getPlayUrl(deviceId: string, channelId: string): Promise<string> {
    const protocol = this.protocols[this.currentProtocolIndex]
    
    try {
      const url = await this.wvpApi.getPlayUrl(deviceId, channelId, protocol)
      
      // 测试播放地址可用性
      await this.testStreamUrl(url)
      return url
    } catch (error) {
      // 自动切换到下一个协议
      this.currentProtocolIndex = (this.currentProtocolIndex + 1) % this.protocols.length
      console.warn(`Protocol ${protocol} failed, switching to ${this.protocols[this.currentProtocolIndex]}`)
      return this.getPlayUrl(deviceId, channelId)
    }
  }

  private async testStreamUrl(url: string): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      const res = await fetch(url, { signal: controller.signal, method: 'HEAD' })
      clearTimeout(timeoutId)
      
      if (!res.ok) throw new Error('Stream unavailable')
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  reset(): void {
    this.currentProtocolIndex = 0
  }
}
