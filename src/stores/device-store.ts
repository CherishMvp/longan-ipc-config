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

export type ChannelSlot = SelectedChannel | null

export const useWVPStore = defineStore('wvp', () => {
  const devices = ref<WVPDevice[]>([])
  const selectedChannels = ref<ChannelSlot[]>(Array(16).fill(null))
  const currentLayout = ref<'3x3' | '4x4'>('3x3')
  const wvpApi = ref<WVPApiService | null>(null)
  const wvpConnected = ref(false)
  const wvpBaseUrl = ref('http://192.168.2.38:18080')

  const maxChannels = computed(() => {
    return currentLayout.value === '3x3' ? 9 : 16
  })

  const activeChannels = computed(() => {
    return selectedChannels.value.filter(c => c !== null) as SelectedChannel[]
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
    
    const maxSlots = currentLayout.value === '3x3' ? 9 : 16
    
    // 找到第一个空的 slot
    let emptySlotIndex = -1
    for (let i = 0; i < maxSlots; i++) {
      if (selectedChannels.value[i] === null) {
        emptySlotIndex = i
        break
      }
    }
    
    if (emptySlotIndex === -1) {
      throw new Error('已达到最大播放路数')
    }
    
    // 达到16路时提示
    const activeCount = selectedChannels.value.filter(c => c !== null).length
    if (activeCount === 15) {
      console.warn('已达到16路上限，下一个将替换最早的播放')
    }
    
    // 超过9路自动切换到4x4
    if (activeCount === 8 && currentLayout.value === '3x3') {
      currentLayout.value = '4x4'
      console.log('自动切换到4x4布局')
    }
    
    const streamContent = await wvpApi.value.startPlay(deviceId, channelId)
    
    const playUrl = streamContent.ws_flv || streamContent.flv || streamContent.hls
    
    if (!playUrl) {
      throw new Error('No playable URL available')
    }
    
    selectedChannels.value[emptySlotIndex] = {
      deviceId,
      channelId,
      name: `${deviceId}/${channelId}`,
      playUrl,
      streamContent,
      status: 'connecting',
      playerIndex: emptySlotIndex,
      reconnectCount: 0
    }
    
    // 少于等于9路自动切换回3x3
    if (activeCount + 1 <= 9 && currentLayout.value === '4x4') {
      setTimeout(() => {
        const count = selectedChannels.value.filter(c => c !== null).length
        if (count <= 9) {
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
    selectedChannels.value[index] = null
    
    console.log('Stopped channel at slot', index)
  }

  async function stopAllChannels() {
    if (!wvpApi.value) {
      return
    }
    
    for (let i = 0; i < selectedChannels.value.length; i++) {
      const channel = selectedChannels.value[i]
      if (channel) {
        await wvpApi.value.stopPlay(channel.deviceId, channel.channelId)
        selectedChannels.value[i] = null
      }
    }
  }

  return {
    devices,
    selectedChannels,
    activeChannels,
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