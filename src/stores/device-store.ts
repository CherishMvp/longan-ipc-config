import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { WVPApiService, WVPDevice, StreamContent } from '@/services/wvp-api'

export interface SelectedChannel {
  deviceId: string
  channelId: string
  name: string
  playUrl?: string
  streamContent?: StreamContent
  status: 'idle' | 'connecting' | 'playing' | 'reconnecting' | 'error'
  playerIndex: number
  reconnectCount: number
}

export const useWVPStore = defineStore('wvp', () => {
  const devices = ref<WVPDevice[]>([])
  const selectedChannels = ref<SelectedChannel[]>([])
  const currentLayout = ref<'3x3' | '4x4'>('3x3')
  const wvpApi = ref<WVPApiService | null>(null)
  const wvpConnected = ref(false)
  const wvpBaseUrl = ref('http://192.168.2.38:18080')

  const maxChannels = computed(() => {
    return currentLayout.value === '3x3' ? 9 : 16
  })

  async function initializeWVP(baseUrl: string, username: string = 'admin', password: string = 'admin') {
    wvpBaseUrl.value = baseUrl
    wvpApi.value = new WVPApiService(baseUrl)
    
    const token = await wvpApi.value.login(username, password)
    wvpConnected.value = true
    
    console.log('WVP initialized, token:', token)
  }

  async function loadDevices() {
    if (!wvpApi.value || !wvpConnected.value) {
      throw new Error('WVP not connected')
    }
    
    const deviceList = await wvpApi.value.getDevices()
    
    for (const device of deviceList) {
      try {
        device.channels = await wvpApi.value.getChannels(device.deviceId)
      } catch (error) {
        console.error(`Failed to get channels for ${device.deviceId}:`, error)
        device.channels = []
      }
    }
    
    devices.value = deviceList
    console.log('Devices loaded:', deviceList.length)
  }

  async function selectChannel(deviceId: string, channelId: string) {
    if (!wvpApi.value) {
      throw new Error('WVP not initialized')
    }
    
    if (selectedChannels.value.length >= maxChannels.value) {
      const removed = selectedChannels.value.shift()
      if (removed) {
        await wvpApi.value.stopPlay(removed.deviceId, removed.channelId)
      }
    }
    
    const streamContent = await wvpApi.value.startPlay(deviceId, channelId)
    
    const playUrl = streamContent.ws_flv || streamContent.flv || streamContent.hls
    
    if (!playUrl) {
      throw new Error('No playable URL available')
    }
    
    selectedChannels.value.push({
      deviceId,
      channelId,
      name: `${deviceId}/${channelId}`,
      playUrl,
      streamContent,
      status: 'connecting',
      playerIndex: selectedChannels.value.length,
      reconnectCount: 0
    })
  }

  async function stopChannel(index: number) {
    if (!wvpApi.value) {
      throw new Error('WVP not initialized')
    }
    
    const channel = selectedChannels.value[index]
    if (!channel) {
      return
    }
    
    await wvpApi.value.stopPlay(channel.deviceId, channel.channelId)
    selectedChannels.value.splice(index, 1)
    
    console.log('Stopped channel:', channel.name)
  }

  async function stopAllChannels() {
    if (!wvpApi.value) {
      return
    }
    
    for (let i = 0; i < selectedChannels.value.length; i++) {
      await stopChannel(i)
    }
    
    selectedChannels.value = []
  }

  return {
    devices,
    selectedChannels,
    currentLayout,
    wvpApi,
    wvpConnected,
    wvpBaseUrl,
    maxChannels,
    initializeWVP,
    loadDevices,
    selectChannel,
    stopChannel,
    stopAllChannels
  }
})