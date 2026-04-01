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
    
    // 清空旧数据，确保刷新时状态更新
    devices.value = []
    
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
    console.log('Devices loaded:', deviceList.length, 'with channels')
  }

  async function selectChannel(deviceId: string, channelId: string) {
    if (!wvpApi.value) {
      throw new Error('WVP not initialized')
    }
    
    // 限制最多16路
    if (selectedChannels.value.length >= 16) {
      throw new Error('已达到最大播放路数（16路）')
    }
    
    // 达到16路时提示
    if (selectedChannels.value.length === 15) {
      console.warn('已达到16路上限，下一个将替换最早的播放')
    }
    
    // 超过9路自动切换到4x4
    if (selectedChannels.value.length === 9 && currentLayout.value === '3x3') {
      currentLayout.value = '4x4'
      console.log('自动切换到4x4布局')
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
    
    // 少于等于9路自动切换回3x3
    if (selectedChannels.value.length <= 9 && currentLayout.value === '4x4') {
      // 延迟切换，避免频繁切换
      setTimeout(() => {
        if (selectedChannels.value.length <= 9) {
          currentLayout.value = '3x3'
          console.log('自动切换回3x3布局')
        }
      }, 500)
    }
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