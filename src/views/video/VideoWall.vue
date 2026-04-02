<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useWVPStore } from '@/stores/device-store'
import { useSettingsStore } from '@/stores/settings'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StreamPlayer from '@/components/VideoPlayer/StreamPlayer.vue'
import MemoryStats from '@/components/VideoPlayer/MemoryStats.vue'
import Toast from '@/components/ui/toast/Toast.vue'
import { useToast } from '@/composables/useToast'
import { Settings2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const store = useWVPStore()
const settingsStore = useSettingsStore()
const toast = useToast()
const router = useRouter()

const loading = ref(false)
const loadingChannels = ref<Set<string>>(new Set())
const expandedDevices = ref<Set<string>>(new Set())
const toastInstance = ref<any>(null)
const filterStatus = ref<'all' | 'online' | 'offline'>('all')
const isFullscreen = ref(false)
const isFirstLoad = ref(true)
const wvpDisabled = ref(false) // WVP 功能禁用标志

const maxSlots = computed(() => {
  return store.currentLayout === '3x3' ? 9 : 16
})

const filteredDevices = computed(() => {
  if (filterStatus.value === 'all') {
    return store.devices
  }
  return store.devices.filter(device => device.status === filterStatus.value)
})

// 是否显示全局 loading（第一次加载且正在连接）
const showGlobalLoading = computed(() => {
  return isFirstLoad.value && loadingChannels.value.size > 0 && store.activeChannels.length === 0
})

async function loadDevices() {
  if (loading.value) return
  
  loading.value = true
  
  try {
    // 确保从 DB 加载最新配置
    await settingsStore.loadFromDB()
    
    // 检查 WVP 是否启用
    if (!settingsStore.wvpConfig.enabled) {
      wvpDisabled.value = true
      loading.value = false
      return
    }
    
    wvpDisabled.value = false
    
    if (!store.wvpConnected) {
      console.log('[VideoWall] Using WVP config from DB:', settingsStore.wvpConfig.baseUrl)
      await store.initializeWVP(
        settingsStore.wvpConfig.baseUrl,
        settingsStore.wvpConfig.username,
        settingsStore.wvpConfig.password
      )
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

function goToSettings() {
  router.push('/settings')
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
  
  const key = `${deviceId}-${channelId}`
  if (loadingChannels.value.has(key)) {
    return
  }
  
  loadingChannels.value.add(key)
  
  try {
    await store.selectChannel(deviceId, channelId)
    toast.success('开始播放')
    
    // 第一次加载成功后，标记为非首次
    if (isFirstLoad.value) {
      isFirstLoad.value = false
    }
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

// 全屏切换
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

// 监听全屏变化
function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  if (toastInstance.value) {
    toast.setToastInstance(toastInstance.value)
  }
  loadDevices()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(() => {
  store.stopAllChannels()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <!-- WVP 功能禁用提示 -->
  <div v-if="wvpDisabled" class="h-screen flex flex-col items-center justify-center bg-background">
    <div class="text-center space-y-4 max-w-md">
      <Settings2 class="w-16 h-16 text-muted-foreground mx-auto" />
      <h2 class="text-xl font-semibold text-foreground">WVP 功能未启用</h2>
      <p class="text-sm text-muted-foreground">
        视频监控功能当前处于禁用状态。请在设置中启用 WVP 功能以使用视频墙。
      </p>
      <Button @click="goToSettings" class="mt-4">
        <Settings2 class="w-4 h-4 mr-2" />
        打开设置
      </Button>
    </div>
  </div>

  <!-- 正常的视频墙界面 -->
  <div v-else class="h-screen flex flex-col bg-background overflow-hidden">
    <!-- 固定 Toolbar -->
    <div class="flex-shrink-0 flex items-center justify-between p-4 border-b bg-background z-10">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold">视频墙</h2>
        
        <!-- 内存统计 -->
        <MemoryStats :player-count="store.selectedChannels.length" />
      </div>
      
      <div class="flex items-center gap-2">
        <!-- 设备状态筛选 -->
        <Select v-model="filterStatus">
          <SelectTrigger class="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部设备</SelectItem>
            <SelectItem value="online">在线设备</SelectItem>
            <SelectItem value="offline">离线设备</SelectItem>
          </SelectContent>
        </Select>
        
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
        
        <!-- 全屏按钮 -->
        <Button variant="outline" size="sm" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
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

          <div v-else-if="filteredDevices.length === 0" class="text-muted-foreground text-sm p-2">
            {{ filterStatus === 'all' ? '暂无设备' : `暂无${filterStatus === 'online' ? '在线' : '离线'}设备` }}
          </div>

          <div v-else class="space-y-2">
            <div v-for="device in filteredDevices" :key="device.deviceId">
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
      <div class="flex-1 p-4 overflow-hidden relative">
        <!-- 第一次加载时的全局 loading -->
        <div 
          v-if="showGlobalLoading"
          class="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <div class="flex flex-col items-center gap-4">
            <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div class="flex flex-col items-center gap-2">
              <p class="text-sm font-medium">正在初始化播放</p>
              <p class="text-xs text-muted-foreground">请稍候...</p>
            </div>
          </div>
        </div>
        
        <!-- 始终显示固定数量的格子 -->
        <div 
          class="grid gap-2 h-full w-full"
          :class="store.currentLayout === '3x3' ? 'grid-cols-3 grid-rows-3' : 'grid-cols-4 grid-rows-4'"
        >
          <!-- 固定格子：根据 playerIndex 查找对应的 channel -->
          <div 
            v-for="slotIndex in maxSlots" 
            :key="`slot-${slotIndex}`"
            class="w-full h-full"
          >
            <!-- 查找 playerIndex 等于当前 slotIndex-1 的 channel -->
            <StreamPlayer
              v-if="store.selectedChannels[slotIndex-1]"
              :device-id="store.selectedChannels[slotIndex-1]!.deviceId"
              :channel-id="store.selectedChannels[slotIndex-1]!.channelId"
              :play-url="store.selectedChannels[slotIndex-1]!.playUrl"
              :stream-content="store.selectedChannels[slotIndex-1]!.streamContent"
              :player-index="slotIndex-1"
              :priority="slotIndex-1 < 4 ? 'high' : 'normal'"
              @close="stopChannel(slotIndex-1)"
            />
            
            <!-- 空白格子占位 -->
            <div
              v-else
              class="w-full h-full bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center"
            >
              <span class="text-muted-foreground/50 text-sm">点击左侧添加</span>
            </div>
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