<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useWVPStore } from '@/stores/device-store'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StreamPlayer from '@/components/VideoPlayer/StreamPlayer.vue'
import MemoryStats from '@/components/VideoPlayer/MemoryStats.vue'
import Toast from '@/components/ui/toast/Toast.vue'
import { useToast } from '@/composables/useToast'

const store = useWVPStore()
const toast = useToast()

const loading = ref(false)
const loadingChannels = ref<Set<string>>(new Set())
const expandedDevices = ref<Set<string>>(new Set())
const toastInstance = ref<any>(null)

const maxSlots = computed(() => {
  return store.currentLayout === '3x3' ? 9 : 16
})

async function loadDevices() {
  if (loading.value) return // 防止重复点击
  
  loading.value = true
  
  try {
    if (!store.wvpConnected) {
      await store.initializeWVP('http://192.168.2.38:18080', 'admin', 'admin')
      toast.success('WVP 连接成功')
    }
    
    await store.loadDevices()
    toast.success(`加载成功：${store.devices.length} 个设备`)
  } catch (err: any) {
    console.error('Load devices error:', err)
    toast.error(`加载失败：${err.message}`)
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
    toast.warning('该通道离线，无法播放')
    return
  }
  
  // 防止重复点击
  const key = `${deviceId}-${channelId}`
  if (loadingChannels.value.has(key)) {
    return
  }
  
  loadingChannels.value.add(key)
  
  try {
    await store.selectChannel(deviceId, channelId)
    toast.success('开始播放')
  } catch (err: any) {
    console.error('Select channel error:', err)
    toast.error(`播放失败：${err.message}`)
  } finally {
    loadingChannels.value.delete(key)
  }
}

async function stopChannel(index: number) {
  try {
    await store.stopChannel(index)
    toast.info('已停止播放')
  } catch (err: any) {
    toast.error(`停止失败：${err.message}`)
  }
}

async function stopAll() {
  try {
    await store.stopAllChannels()
    toast.info('已停止所有播放')
  } catch (err: any) {
    toast.error(`停止失败：${err.message}`)
  }
}

onMounted(() => {
  // 初始化 toast 实例
  if (toastInstance.value) {
    toast.setToastInstance(toastInstance.value)
  }
  loadDevices()
})

onBeforeUnmount(() => {
  store.stopAllChannels()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-background overflow-hidden">
    <!-- 固定 Toolbar -->
    <div class="flex-shrink-0 flex items-center justify-between p-4 border-b bg-background z-10">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold">视频墙</h2>
        
        <!-- 内存统计 -->
        <MemoryStats :player-count="store.selectedChannels.length" />
      </div>
      
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

    <!-- Toast 组件 -->
    <Toast ref="toastInstance" />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 固定宽度侧边栏，内部滚动 -->
      <div class="flex-shrink-0 w-64 border-r bg-background overflow-hidden flex flex-col">
        <div class="flex-1 overflow-y-auto p-4 scrollbar-hide">
          <div v-if="loading" class="flex items-center justify-center h-32">
            <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>

          <div v-else-if="store.devices.length === 0" class="text-muted-foreground text-sm p-2">
            暂无设备
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
      </div>

      <!-- 视频网格区域 -->
      <div class="flex-1 p-4 overflow-hidden">
        <div v-if="store.selectedChannels.length === 0" class="flex items-center justify-center h-full">
          <p class="text-muted-foreground">点击左侧设备通道开始播放</p>
        </div>

        <!-- 固定网格布局：每个格子均分 -->
        <div 
          v-else 
          class="grid gap-2 h-full w-full"
          :class="store.currentLayout === '3x3' ? 'grid-cols-3 grid-rows-3' : 'grid-cols-4 grid-rows-4'"
        >
          <!-- 已播放的通道 -->
          <StreamPlayer
            v-for="(channel, index) in store.selectedChannels"
            :key="`${channel.deviceId}-${channel.channelId}`"
            :device-id="channel.deviceId"
            :channel-id="channel.channelId"
            :play-url="channel.playUrl"
            :stream-content="channel.streamContent"
            :player-index="index"
            :priority="channel.playerIndex < 4 ? 'high' : 'normal'"
            @close="stopChannel(index)"
          />
          
          <!-- 空白格子占位：填充剩余位置 -->
          <div
            v-for="i in (maxSlots - store.selectedChannels.length)"
            :key="`empty-${i}`"
            class="aspect-video bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center"
          >
            <span class="text-muted-foreground/50 text-sm">点击左侧添加</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Grid 容器：每个格子均分 */
.grid {
  display: grid;
  width: 100%;
  height: 100%;
}

.grid-cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.grid-rows-3 {
  grid-template-rows: repeat(3, 1fr);
}

.grid-rows-4 {
  grid-template-rows: repeat(4, 1fr);
}

/* 确保每个格子不超出 */
.grid > * {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* 隐藏默认滚动条 */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>