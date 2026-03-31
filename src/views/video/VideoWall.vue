<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import StreamPlayer from '@/components/VideoPlayer/StreamPlayer.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useDeviceStore } from '@/stores/device-store'

interface DeviceConfig {
  deviceId: string
  channelId: string
  name?: string
  priority: 'high' | 'normal' | 'low'
  playUrl: string
}

const store = useDeviceStore()
const devices = ref<DeviceConfig[]>([])
const loading = ref(true)
const layout = ref<'3x3' | '4x4'>('3x3')

const gridClass = computed(() => ({
  'grid-cols-3': layout.value === '3x3',
  'grid-cols-4': layout.value === '4x4'
}))

// 获取播放地址
async function getPlayUrl(deviceId: string, channelId: string): Promise<string> {
  try {
    if (!store.wvpApi) {
      store.initializeWVP('http://192.168.2.38:18080', '')
    }
    
    // 确保已登录
    if (!store.wvpApi.token) {
      await store.wvpApi.login('admin', 'admin')
    }
    
    const url = await store.wvpApi.getPlayUrl(deviceId, channelId, 'http-flv')
    console.log(`Play URL for ${deviceId}/${channelId}:`, url)
    return url
  } catch (error) {
    console.error('Failed to get play URL:', error)
    return ''
  }
}

// 从 WVP 获取设备列表
async function loadDevices() {
  try {
    loading.value = true
    
    // 初始化 WVP API
    if (!store.wvpApi) {
      store.initializeWVP('http://192.168.2.38:18080', '')
    }
    
    // 登录获取 token - 密码 admin 的 MD5 (32 位小写)
    const token = await store.wvpApi.login('admin', 'admin')
    console.log('WVP Login success, token:', token)
    
    // 获取设备列表
    const wvpDevices = await store.wvpApi.getDevices()
    console.log('WVP Devices:', wvpDevices)
    
    // 获取每个设备的频道并转换格式
    const allDevices: DeviceConfig[] = []
    for (const device of wvpDevices) {
      try {
        const channels = await store.wvpApi!.getChannels(device.deviceId)
        channels.forEach(channel => {
          allDevices.push({
            deviceId: device.deviceId,
            channelId: channel.channelId,
            name: channel.name,
            priority: 'normal' as const,
            playUrl: '' // 初始为空，下面会设置固定地址
          })
        })
      } catch (err) {
        console.error(`Failed to get channels for ${device.deviceId}:`, err)
      }
    }
    
    // 给前 9 台设备设置固定的播放地址
    const fixedPlayUrl = 'ws://192.168.2.38/rtp/41010500001320000177_41010500001320000177.live.flv?originTypeStr=rtp_push'
    allDevices.slice(0, 9).forEach((device, index) => {
      device.playUrl = fixedPlayUrl
      console.log(`Set play URL for device ${index + 1}:`, device.deviceId, device.channelId)
    })
    
    devices.value = allDevices.slice(0, 16) // 限制最多 16 路
    console.log('Converted devices:', devices.value)
  } catch (error) {
    console.error('Failed to load WVP devices:', error)
    // 使用测试数据
    devices.value = [
      { deviceId: '1', channelId: '1', priority: 'high', playUrl: 'ws://192.168.2.38/rtp/41010500001320000177_41010500001320000177.live.flv?originTypeStr=rtp_push' },
      { deviceId: '2', channelId: '2', priority: 'normal', playUrl: '' },
      { deviceId: '3', channelId: '3', priority: 'normal', playUrl: '' },
      { deviceId: '4', channelId: '4', priority: 'normal', playUrl: '' },
    ]
  } finally {
    loading.value = false
  }
}
    
    // 登录获取 token - 密码 admin 的 MD5 (32 位小写)
    const token = await store.wvpApi.login('admin', 'admin')
    console.log('WVP Login success, token:', token)
    
    // 获取设备列表
    const wvpDevices = await store.wvpApi.getDevices()
    console.log('WVP Devices:', wvpDevices)
    
    // 获取每个设备的频道并转换格式
    const allDevices: DeviceConfig[] = []
    for (const device of wvpDevices) {
      try {
        const channels = await store.wvpApi!.getChannels(device.deviceId)
        channels.forEach(channel => {
          allDevices.push({
            deviceId: device.deviceId,
            channelId: channel.channelId,
            name: channel.name,
            priority: 'normal' as const,
            playUrl: '' // 初始为空，点击播放时再获取
          })
        })
      } catch (err) {
        console.error(`Failed to get channels for ${device.deviceId}:`, err)
      }
    }
    
    devices.value = allDevices.slice(0, 16) // 限制最多 16 路
    console.log('Converted devices:', devices.value)
  } catch (error) {
    console.error('Failed to load WVP devices:', error)
    // 使用测试数据
    devices.value = [
      { deviceId: '1', channelId: '1', priority: 'high', playUrl: '' },
      { deviceId: '2', channelId: '2', priority: 'normal', playUrl: '' },
      { deviceId: '3', channelId: '3', priority: 'normal', playUrl: '' },
      { deviceId: '4', channelId: '4', priority: 'normal', playUrl: '' },
    ]
  } finally {
    loading.value = false
  }
}

// 处理播放器请求 URL 事件
async function handleRequestUrl(deviceId: string, channelId: string, index: number) {
  console.log(`Request URL for ${deviceId}/${channelId}`)
  const url = await getPlayUrl(deviceId, channelId)
  if (url) {
    devices.value[index].playUrl = url
    console.log(`Got URL for ${deviceId}/${channelId}:`, url)
  }
}

onMounted(() => {
  loadDevices()
})
</script>

<template>
  <div class="w-full h-full p-4">
    <!-- 顶部工具栏 -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Live Video Wall</h2>
      <div class="flex items-center gap-2">
        <Select v-model="layout">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="Layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3x3">3×3 (9 路)</SelectItem>
            <SelectItem value="4x4">4×4 (16 路)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" @click="loadDevices" :loading="loading">
          Refresh
        </Button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-2">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-muted-foreground">Loading devices from WVP...</span>
      </div>
    </div>

    <!-- 视频网格 -->
    <div v-else :class="['grid gap-3', gridClass]">
      <StreamPlayer
        v-for="(device, index) in devices"
        :key="index"
        :device-id="device.deviceId"
        :channel-id="device.channelId"
        :priority="device.priority"
        :play-url="device.playUrl"
        @request-url="handleRequestUrl(device.deviceId, device.channelId, index)"
      />
    </div>
  </div>
</template>

<style scoped>
.grid {
  @apply auto-rows-fr;
}
</style>
