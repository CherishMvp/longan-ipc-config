import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { WVPApiService, WVPDevice, StreamContent, setWVPLogger } from '@/services/wvp-api'
import { useSettingsStore } from './settings'
import { useLogger } from '@/composables/useLogger'

const logger = useLogger()
setWVPLogger(logger)

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

  async function initializeWVP(baseUrl?: string, username?: string, password?: string) {
    const settingsStore = useSettingsStore()
    
    const finalBaseUrl = baseUrl || settingsStore.wvpConfig.baseUrl
    const finalUsername = username || settingsStore.wvpConfig.username
    const finalPassword = password || settingsStore.wvpConfig.password
    
    logger.info('wvp', `初始化 WVP`, {
      baseUrl: finalBaseUrl,
      username: finalUsername,
      enabled: settingsStore.wvpConfig.enabled
    })
    
    wvpBaseUrl.value = finalBaseUrl
    wvpApi.value = new WVPApiService(finalBaseUrl)
    
    const token = await wvpApi.value.login(finalUsername, finalPassword)
    wvpConnected.value = true
    
    logger.info('wvp', `WVP 初始化成功`)
    console.log('WVP initialized, token:', token)
  }

  async function loadDevices() {
    if (!wvpApi.value || !wvpConnected.value) {
      logger.error('wvp', `WVP 未连接，无法加载设备`)
      throw new Error('WVP not connected')
    }
    
    logger.info('wvp', `开始加载设备列表`)
    
    devices.value = []
    
    const deviceList = await wvpApi.value.getDevices()
    
    for (const device of deviceList) {
      try {
        device.channels = await wvpApi.value.getChannels(device.deviceId)
      } catch (error: any) {
        logger.warn('wvp', `获取设备通道失败`, {
          deviceId: device.deviceId,
          error: error.message
        })
        device.channels = []
      }
    }
    
    devices.value = deviceList
    logger.info('wvp', `设备列表加载完成`, { count: deviceList.length })
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
    
    logger.info('wvp', `收到流地址`, {
      deviceId,
      channelId,
      flv: streamContent.flv,
      ws_flv: streamContent.ws_flv,
      hls: streamContent.hls
    })
    
    // 优先使用 WS-FLV（无跨域限制），其次是 HTTP-FLV，最后是 HLS
    let playUrl = streamContent.ws_flv || streamContent.flv || streamContent.hls
    
    if (!playUrl) {
      throw new Error('No playable URL available')
    }
    
    // 如果是 ws_flv，需要拼接 token 认证
    if (playUrl === streamContent.ws_flv && wvpApi.value) {
      const token = wvpApi.value.getToken()
      if (token && !playUrl.includes('token=')) {
        playUrl = `${playUrl}?token=${token}`
      }
    }
    
    logger.info('wvp', `最终播放地址`, { playUrl })
    
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