<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import mpegts from 'mpegts.js'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const props = defineProps<{
  deviceId: string
  channelId: string
  priority?: 'high' | 'normal' | 'low'
  playUrl?: string
  streamContent?: any  // 支持协议降级
  playerIndex: number
}>()

const emit = defineEmits<{
  (e: 'error', error: Error): void
  (e: 'reconnect'): void
  (e: 'request-url'): void
  (e: 'close'): void  // 关闭播放器
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
let player: mpegts.Player | null = null
const signalQuality = ref<'good' | 'fair' | 'poor'>('good')
const isConnecting = ref(true)
const isError = ref(false)
const retryCount = ref(0)
const hasShownError = ref(false) // 记录是否已显示过错误
const hasLoadedUrl = ref(false)  // 记录是否已加载过 URL

const bufferConfig = computed(() => {
  const priority = props.priority || 'normal'
  if (priority === 'high') return { stashInitialSize: 2048 * 1024 }
  if (priority === 'normal') return { stashInitialSize: 1024 * 1024 }
  return { stashInitialSize: 512 * 1024 }
})

// 暴露给健康监控的方法
function getStats() {
  const stats = player?.statisticsInfo as any
  return {
    bitrate: stats?.speed || 0,
    bufferedLength: (player as any)?.bufferedLength || 0
  }
}

function triggerReconnect() {
  if (!isConnecting.value) {
    handleReconnect()
  }
}

function getStatus() {
  if (isError.value) return 'error'
  if (isConnecting.value) return retryCount.value > 0 ? 'reconnecting' : 'connecting'
  return 'playing'
}

defineExpose({
  getStats,
  triggerReconnect,
  getStatus,
  updateSignalQuality
})

onMounted(() => {
  initPlayer()
  startQualityMonitoring()
})

onUnmounted(() => {
  destroyPlayer()
})

async function initPlayer() {
  // 如果没有播放地址且没有加载过，请求父组件获取
  if (!props.playUrl && !hasLoadedUrl.value) {
    hasLoadedUrl.value = true
    emit('request-url')
    isConnecting.value = false
    return
  }
  
  // 如果仍然没有地址，跳过
  if (!props.playUrl) {
    isConnecting.value = false
    return
  }

  try {
    isConnecting.value = true
    isError.value = false

    player = mpegts.createPlayer({
      type: 'flv',
      url: props.playUrl,
      isLive: true,
      hasAudio: false
    }, {
      enableWorker: true,
      enableStashBuffer: true,
      ...bufferConfig.value,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: props.priority === 'high' ? 2.0 : 5.0
    })

    player.attachMediaElement(videoRef.value as any)
    
    player.on(mpegts.Events.ERROR, handlePlayerError)
    player.on(mpegts.Events.STATISTICS_INFO, updateSignalQuality)

    player.load()
    await player.play()
  } catch (error) {
    console.error('Player init failed:', error)
    isError.value = true
    hasShownError.value = true  // 不再显示错误
    emit('error', error as Error)
  }
}

function handlePlayerError() {
  if (retryCount.value >= 10 || hasShownError.value) {
    // 超过重试次数或已显示过错误，不再显示弹窗
    return
  }
  
  handleReconnect()
}

function handleReconnect() {
  retryCount.value++
  isConnecting.value = true
  emit('reconnect')
  
  // 保留最后一帧，静默重连
  setTimeout(() => initPlayer(), 2000)
}

function updateSignalQuality(stats: any) {
  isConnecting.value = false
  
  if (stats.speed > 1024 * 1024) signalQuality.value = 'good'
  else if (stats.speed > 512 * 1024) signalQuality.value = 'fair'
  else signalQuality.value = 'poor'
}

function startQualityMonitoring() {
  const interval = setInterval(() => {
    if (player && player.type === 'flv') {
      const stats = (player as any).getStatistics()
      updateSignalQuality(stats)
    }
  }, 5000)

  onUnmounted(() => clearInterval(interval))
}

function destroyPlayer() {
  if (player) {
    player.pause()
    player.unload()
    player.detachMediaElement()
    player.destroy()
    player = null
  }
}
</script>

<template>
  <div class="relative aspect-video bg-black rounded-lg overflow-hidden border border-border group">
    <!-- 视频层 -->
    <video
      ref="videoRef"
      class="w-full h-full object-contain"
      :class="{ 'opacity-50': isConnecting && retryCount > 0 }"
      muted
      playsinline
      autoplay
    />

    <!-- 关闭按钮 -->
    <button
      v-if="!isConnecting && !isError"
      class="absolute top-2 left-2 z-10 p-1.5 bg-black/50 hover:bg-black/70 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
      @click="emit('close')"
      title="关闭"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- 信号质量指示器 -->
    <Badge
      variant="outline"
      class="absolute top-2 right-2 z-10"
      :class="{
        'bg-green-500/20 border-green-500 text-green-500': signalQuality === 'good',
        'bg-yellow-500/20 border-yellow-500 text-yellow-500': signalQuality === 'fair',
        'bg-red-500/20 border-red-500 text-red-500': signalQuality === 'poor'
      }"
    >
      {{ signalQuality === 'good' ? '●' : signalQuality === 'fair' ? '◐' : '○' }}
      <span class="ml-1 text-[10px]">{{ signalQuality.toUpperCase() }}</span>
    </Badge>

    <!-- 加载状态 -->
    <div v-if="isConnecting" class="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div class="flex flex-col items-center gap-2">
        <Skeleton class="w-10 h-10 rounded-full" />
        <span class="text-xs text-muted-foreground font-mono">
          {{ retryCount > 0 ? `RECONNECTING #${retryCount}` : 'CONNECTING...' }}
        </span>
      </div>
    </div>

    <!-- 错误提示 - 只显示一次 -->
    <AlertDialog v-if="isError && !hasShownError" :open="true">
      <AlertDialogContent class="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Stream Connection Failed</AlertDialogTitle>
          <AlertDialogDescription>
            Unable to connect to camera stream after {{ retryCount }} attempts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction @click="hasShownError = true; isError = false; retryCount = 0; initPlayer()">
            Retry Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Hover 信息条 -->
    <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
      <div class="flex items-center justify-between text-[10px] text-white/70 font-mono">
        <span>{{ deviceId }}</span>
        <span>{{ (props.priority || 'normal').toUpperCase() }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
video {
  outline: none;
}
</style>
