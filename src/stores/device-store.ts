import { defineStore } from 'pinia'
import { WVPApiService } from '@/services/wvp-api'
import { StreamProtocolManager } from '@/services/stream-protocol-manager'

export interface DeviceState {
  deviceId: string
  channelId: string
  name: string
  status: 'online' | 'offline'
  playUrl: string | null
  priority: 'high' | 'normal' | 'low'
}

interface DeviceStoreState {
  devices: DeviceState[]
  loading: boolean
  error: string | null
  wvpApi: WVPApiService | null
  protocolManager: StreamProtocolManager | null
}

export const useDeviceStore = defineStore('devices', {
  state: (): DeviceStoreState => ({
    devices: [],
    loading: false,
    error: null,
    wvpApi: null,
    protocolManager: null
  }),

  getters: {
    onlineDevices: (state) => state.devices.filter(d => d.status === 'online'),
    highPriorityDevices: (state) => state.devices.filter(d => d.priority === 'high')
  },

  actions: {
    initializeWVP(baseUrl: string, token: string) {
      const api = new WVPApiService(baseUrl)
      api.setToken(token)
      this.wvpApi = api
      this.protocolManager = new StreamProtocolManager(api)
    },

    async syncDevices() {
      if (!this.wvpApi) throw new Error('WVP API not initialized')

      this.loading = true
      this.error = null

      try {
        const wvpDevices = await this.wvpApi.getDevices()
        
        this.devices = wvpDevices.flatMap(device =>
          device.channels.map(channel => ({
            deviceId: device.deviceId,
            channelId: channel.channelId,
            name: channel.name,
            status: channel.status as 'online' | 'offline',
            playUrl: null,
            priority: 'normal' as const
          }))
        )
      } catch (error) {
        this.error = (error as Error).message
      } finally {
        this.loading = false
      }
    },

    async getPlayUrl(deviceId: string, channelId: string): Promise<string> {
      if (!this.protocolManager) throw new Error('Protocol manager not initialized')

      const url = await this.protocolManager.getPlayUrl(deviceId, channelId)
      
      // Update device state
      const device = this.devices.find(d => d.deviceId === deviceId && d.channelId === channelId)
      if (device) {
        device.playUrl = url
      }

      return url
    },

    updateDeviceStatus(deviceId: string, channelId: string, status: 'online' | 'offline') {
      const device = this.devices.find(d => d.deviceId === deviceId && d.channelId === channelId)
      if (device) {
        device.status = status
      }
    }
  }
})
