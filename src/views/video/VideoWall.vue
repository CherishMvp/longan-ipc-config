<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useDeviceStore } from '@/stores/device-store'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StreamPlayer from '@/components/VideoPlayer/StreamPlayer.vue'

const store = useDeviceStore()

const loading = ref(false)
const error = ref<string | null>(null)
const expandedDevices = ref<Set<string>>(new Set())

async function loadDevices() {
  loading.value = true
  error.value = null
  
  try {
    if (!store.wvpConnected) {
      await store.initializeWVP('http://192.168.2.38:18080', 'admin', 'admin')
    }
    
    await store.loadDevices()
  } catch (err: any) {
    error.value = err.message || '加载设备失败'
    console.error('Load devices error:', err)
  } finally {
    loading.value = false
  }
}

function toggleDevice(deviceId: string) {
  if (expandedDevices.value.has(deviceId)) {
    expandedDevices.value.delete(deviceId)
  } else {
    expandedDevices.value.add(deviceId)
  }
}

async function handleChannelClick(deviceId: string, channelId: string, status: string) {
  if (status === 'offline') {
    return
  }
  
  try {
    await store.selectChannel(deviceId, channelId)
  } catch (err: any) {
    console.error('Select channel error:', err)
    error.value = err.message
    setTimeout(() => error.value = null, 3000)
  }
}

async function stopAll() {
  await store.stopAllChannels()
}

onMounted(() => {
  loadDevices()
})

onBeforeUnmount(() => {
  store.stopAllChannels()
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-background">
    <!-- Toolbar -->
    <div class="flex items-center justify-between p-4 border-b">
      <h2 class="text-lg font-semibold">视频墙</h2>
      <div class="flex items-center gap-2">
        <Select v-model="store.currentLayout">
          <SelectTrigger class="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3x3">3×3 (9路)</SelectItem>
            <SelectItem value="4x4">4×4 (16路)</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="sm" @click="loadDevices" :disabled="loading">
          刷新设备
        </Button>
        
        <Button variant="outline" size="sm" @click="stopAll" :disabled="store.selectedChannels.length === 0">
          停止全部
        </Button>
      </div>
    </div>

    <!-- Error Toast -->
    <div v-if="error" class="fixed top-4 right-4 z-50 p-4 bg-red-500 text-white rounded-lg shadow-lg">
      {{ error }}
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Device Tree -->
      <div class="w-64 border-r overflow-y-auto p-4">
        <div v-if="loading" class="flex items-center justify-center h-32">
          <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>

        <div v-else-if="error" class="text-red-400 text-sm p-2">
          {{ error }}
        </div>

        <div v-else class="space-y-2">
          <div v-for="device in store.devices" :key="device.deviceId">
            <!-- Device Header -->
            <div 
              class="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
              @click="toggleDevice(device.deviceId)"
            >
              <div class="flex items-center gap-2">
                <Badge 
                  :variant="device.status === 'online' ? 'default' : 'outline'"
                  :class="device.status === 'online' ? 'bg-green-500' : 'bg-gray-500'"
                >
                  {{ device.status === 'online' ? '在线' : '离线' }}
                </Badge>
                <span class="text-sm">{{ device.name }}</span>
              </div>
              <span class="text-muted-foreground text-xs">
                {{ expandedDevices.has(device.deviceId) ? '▼' : '▶' }}
              </span>
            </div>

            <!-- Channels -->
            <div v-if="expandedDevices.has(device.deviceId)" class="ml-4 mt-2 space-y-1">
              <div 
                v-for="channel in device.channels"
                :key="channel.channelId"
                class="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm"
                :class="{ 'opacity-50 cursor-not-allowed': channel.status === 'offline' }"
                @click="handleChannelClick(device.deviceId, channel.channelId, channel.status)"
              >
                <Badge 
                  :variant="channel.status === 'online' ? 'default' : 'outline'"
                  :class="channel.status === 'online' ? 'bg-green-500' : 'bg-gray-500'"
                >
                  {{ channel.status === 'online' ? '在线' : '离线' }}
                </Badge>
                <span class="text-xs text-muted-foreground">{{ channel.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Video Grid -->
      <div class="flex-1 p-4 overflow-hidden">
        <div v-if="store.selectedChannels.length === 0" class="flex items-center justify-center h-full">
          <p class="text-muted-foreground">点击左侧设备通道开始播放</p>
        </div>

        <div 
          v-else 
          :class="[
            'grid gap-2 h-full',
            store.currentLayout === '3x3' ? 'grid-cols-3' : 'grid-cols-4'
          ]"
        >
          <StreamPlayer
            v-for="(channel, index) in store.selectedChannels"
            :key="`${channel.deviceId}-${channel.channelId}`"
            :device-id="channel.deviceId"
            :channel-id="channel.channelId"
            :play-url="channel.playUrl"
            :stream-content="channel.streamContent"
            :player-index="index"
            :priority="channel.playerIndex < 4 ? 'high' : 'normal'"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  auto-rows-fr: 1fr;
}
</style>