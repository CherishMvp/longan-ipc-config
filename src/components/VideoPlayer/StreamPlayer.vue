<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import mpegts from 'mpegts.js'
import { useLogger } from '@/composables/useLogger'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const logger = useLogger()
const props = defineProps<{
  deviceId: string
  channelId: string
  priority?: 'high' | 'normal' | 'low'
  playUrl?: string
  streamContent?: any
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
const hasShownError = ref(false)
const hasLoadedUrl = ref(false)
const showDiagnostics = ref(false)

const diagnostics = ref({
  mseSupported: false,
  h264Supported: false,
  isLowEndDevice: false,
  cpuCores: 0,
  videoReadyState: 0,
  videoNetworkState: 0,
  videoWidth: 0,
  videoHeight: 0,
  videoError: null as { code: number; message: string } | null,
  lastError: ''
})

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
  startHeartbeat()
})

onUnmounted(() => {
  stopHeartbeat()
  destroyPlayer()
})

function updateDiagnostics() {
    const video = videoRef.value
    if (!video) return
    
    diagnostics.value.videoReadyState = video.readyState
    diagnostics.value.videoNetworkState = video.networkState
    diagnostics.value.videoWidth = video.videoWidth
    diagnostics.value.videoHeight = video.videoHeight
    
    if (video.error) {
      diagnostics.value.videoError = {
        code: video.error.code,
        message: video.error.message
      }
    }
  }
  
  function toggleDiagnostics() {
    updateDiagnostics()
    showDiagnostics.value = !showDiagnostics.value
  }

  async function initPlayer() {
    if (!props.playUrl && !hasLoadedUrl.value) {
      hasLoadedUrl.value = true
      emit('request-url')
      isConnecting.value = false
      return
    }
    
    if (!props.playUrl) {
      isConnecting.value = false
      return
    }

    // 检测 MSE 支持
    const mseSupported = typeof MediaSource !== 'undefined'
    const h264Supported = mseSupported && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')
    const isLowEndDevice = navigator.hardwareConcurrency <= 4
    
    // 判断 URL 类型
    const isWsUrl = props.playUrl.startsWith('ws://') || props.playUrl.startsWith('wss://')
    const isHttpUrl = props.playUrl.startsWith('http://') || props.playUrl.startsWith('https://')
    
    diagnostics.value.mseSupported = mseSupported
    diagnostics.value.h264Supported = h264Supported
    diagnostics.value.isLowEndDevice = isLowEndDevice
    diagnostics.value.cpuCores = navigator.hardwareConcurrency

    logger.info('player', `初始化播放器 [${props.playerIndex}]`, {
      deviceId: props.deviceId,
      channelId: props.channelId,
      url: props.playUrl,
      urlType: isWsUrl ? 'websocket' : isHttpUrl ? 'http' : 'unknown',
      priority: props.priority,
      mseSupported,
      h264Supported,
      isLowEndDevice,
      cpuCores: navigator.hardwareConcurrency
    })

    try {
      isConnecting.value = true
      isError.value = false

      player = mpegts.createPlayer({
        type: 'flv',
        url: props.playUrl,
        isLive: true,
        hasAudio: false
      }, {
        enableWorker: !isLowEndDevice,
        enableStashBuffer: true,
        stashInitialSize: isLowEndDevice ? 512 * 1024 : 1024 * 1024,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: props.priority === 'high' ? 2.0 : 5.0,
        autoCleanupSourceBuffer: true,
        fixAudioTimestampGap: false,
      })

      player.attachMediaElement(videoRef.value as any)
      
      const video = videoRef.value!
      video.addEventListener('loadeddata', () => {
        isConnecting.value = false  // 视频数据加载完成，关闭 loading
        logger.info('player', `Video loaded [${props.playerIndex}]`, { deviceId: props.deviceId })
      })
      
      video.addEventListener('error', (e) => {
        const error = video.error
        diagnostics.value.videoError = error ? { code: error.code, message: error.message } : null
        diagnostics.value.lastError = `Video error: code=${error?.code}, msg=${error?.message}`
        isConnecting.value = false  // 错误时也关闭 loading
        
        logger.error('player', `Video 元素错误 [${props.playerIndex}]`, {
          code: error?.code,
          message: error?.message,
          deviceId: props.deviceId
        })
      })
      
      video.addEventListener('stalled', () => {
        diagnostics.value.lastError = 'Video stalled'
        logger.warn('player', `Video stalled [${props.playerIndex}]`, { deviceId: props.deviceId })
      })
      
      video.addEventListener('waiting', () => {
        diagnostics.value.lastError = 'Video waiting for data'
        logger.warn('player', `Video waiting [${props.playerIndex}]`, { deviceId: props.deviceId })
      })
      
      video.addEventListener('playing', () => {
        diagnostics.value.lastError = ''
        updateDiagnostics()
        isConnecting.value = false  // 确保 loading 关闭
        
        logger.info('player', `Video playing [${props.playerIndex}]`, {
          deviceId: props.deviceId,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState
        })
      })
      
      player.on(mpegts.Events.ERROR, (type, detail, info) => {
        diagnostics.value.lastError = `mpegts error: ${type} - ${detail}`
        
        logger.error('player', `mpegts.js 错误 [${props.playerIndex}]`, {
          type,
          detail,
          info,
          deviceId: props.deviceId
        })
        handlePlayerError(type, detail, info)
      })
      
      player.on(mpegts.Events.STATISTICS_INFO, updateSignalQuality)
      
      player.on(mpegts.Events.METADATA_ARRIVED, (metadata) => {
        logger.info('player', `收到视频元数据 [${props.playerIndex}]`, {
          width: metadata.width,
          height: metadata.height,
          framerate: metadata.framerate,
          deviceId: props.deviceId
        })
      })

      player.load()
      await player.play()
      
      logger.info('player', `播放器启动成功 [${props.playerIndex}]`, {
        isLowEndDevice,
        workerEnabled: !isLowEndDevice
      })
    } catch (error: any) {
      diagnostics.value.lastError = `Init error: ${error.message}`
      
      logger.error('player', `播放器初始化失败 [${props.playerIndex}]`, {
        error: error.message,
        stack: error.stack,
        deviceId: props.deviceId,
        channelId: props.channelId
      })
      isError.value = true
      hasShownError.value = true
      emit('error', error as Error)
    }
  }

function handlePlayerError(type?: string, detail?: string, info?: any) {
  if (retryCount.value >= 10 || hasShownError.value) {
    return
  }
  
  logger.error('player', `播放错误 [${props.playerIndex}]`, {
    type,
    detail,
    info,
    retryCount: retryCount.value
  })
  
  handleReconnect()
}

function handleReconnect() {
  retryCount.value++
  isConnecting.value = true
  
  // 指数退避：延迟随重试次数增加，最大 30 秒
  const delay = Math.min(2000 * Math.pow(1.5, retryCount.value - 1), 30000)
  
  logger.info('player', `播放器重连 [${props.playerIndex}]`, {
    retryCount: retryCount.value,
    delay: `${Math.round(delay / 1000)}s`,
    deviceId: props.deviceId,
    channelId: props.channelId
  })
  
  emit('reconnect')
  setTimeout(() => initPlayer(), delay)
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

// ==================== 播放状态心跳检测 ====================
let heartbeatInterval: NodeJS.Timeout | null = null
let lastReadyState = 0
let stuckCount = 0

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  
  heartbeatInterval = setInterval(() => {
    const video = videoRef.value
    if (!video || isError.value) return
    
    // 情况1：视频暂停但流正常（非用户主动暂停）
    if (video.paused && !isConnecting.value && retryCount.value < 10) {
      logger.warn('player', `检测到视频暂停，自动恢复 [${props.playerIndex}]`, {
        deviceId: props.deviceId,
        paused: video.paused,
        readyState: video.readyState
      })
      
      video.play().catch(e => {
        logger.error('player', '自动恢复失败', { error: e.message })
        // 播放失败，尝试重建播放器
        if (retryCount.value < 10) {
          handleReconnect()
        }
      })
      return
    }
    
    // 情况2：解码器假死检测（readyState 长时间未变化且有流）
    if (!isConnecting.value && !isError.value) {
      const currentReadyState = video.readyState
      
      if (currentReadyState === lastReadyState && currentReadyState > 0) {
        stuckCount++
        
        // 连续 3 次检测到 readyState 未变化，判定为假死
        if (stuckCount >= 3) {
          logger.warn('player', `检测到解码器假死，触发重连 [${props.playerIndex}]`, {
            deviceId: props.deviceId,
            readyState: currentReadyState,
            stuckCount
          })
          
          stuckCount = 0
          handleReconnect()
          return
        }
      } else {
        stuckCount = 0
      }
      
      lastReadyState = currentReadyState
    }
    
    // 情况3：流中断检测（有播放器实例但 video 无数据）
    if (player && !isConnecting.value && video.readyState === 0 && video.networkState === 2) {
      logger.warn('player', `检测到流中断，触发重连 [${props.playerIndex}]`, {
        deviceId: props.deviceId,
        networkState: video.networkState
      })
      
      handleReconnect()
    }
  }, 5000) // 每 5 秒检测一次
  
  onUnmounted(() => {
    if (heartbeatInterval) clearInterval(heartbeatInterval)
  })
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

function destroyPlayer() {
  stopHeartbeat()
  
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
  <div class="relative w-full h-full bg-black rounded-lg overflow-hidden border border-border group">
    <!-- 视频层 -->
    <video
      ref="videoRef"
      class="w-full h-full object-contain"
      :class="{ 'opacity-50': isConnecting && retryCount > 0 }"
      muted
      playsinline
      autoplay
    />

    <!-- 关闭按钮 - 始终显示 -->
    <button
      class="absolute top-2 left-2 z-20 p-1.5 bg-black/50 hover:bg-black/70 rounded text-white transition-opacity"
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

    <!-- 诊断信息面板 -->
    <div 
      v-if="showDiagnostics"
      class="absolute inset-0 bg-black/90 z-20 p-4 overflow-auto"
    >
      <div class="text-xs font-mono text-green-400 space-y-2">
        <div class="flex justify-between border-b border-green-900 pb-2 mb-2">
          <span class="text-green-300">播放器诊断信息</span>
          <button @click="showDiagnostics = false" class="text-red-400 hover:text-red-300">[关闭]</button>
        </div>
        
        <div>MSE 支持: <span :class="diagnostics.mseSupported ? 'text-green-400' : 'text-red-400'">{{ diagnostics.mseSupported ? 'YES' : 'NO' }}</span></div>
        <div>H.264 支持: <span :class="diagnostics.h264Supported ? 'text-green-400' : 'text-red-400'">{{ diagnostics.h264Supported ? 'YES' : 'NO' }}</span></div>
        <div>低配设备: <span class="text-yellow-400">{{ diagnostics.isLowEndDevice ? 'YES' : 'NO' }}</span></div>
        <div>Worker 启用: <span :class="!diagnostics.isLowEndDevice ? 'text-green-400' : 'text-yellow-400'">{{ !diagnostics.isLowEndDevice ? 'YES' : 'NO (自动禁用)' }}</span></div>
        <div>CPU 核心: <span class="text-blue-400">{{ diagnostics.cpuCores }}</span></div>
        
        <div class="border-t border-green-900 pt-2 mt-2">
          <div>视频状态:</div>
          <div class="pl-2">
            <div>readyState: <span class="text-blue-400">{{ diagnostics.videoReadyState }}</span></div>
            <div>networkState: <span class="text-blue-400">{{ diagnostics.videoNetworkState }}</span></div>
            <div>videoWidth: <span class="text-blue-400">{{ diagnostics.videoWidth || 'N/A' }}</span></div>
            <div>videoHeight: <span class="text-blue-400">{{ diagnostics.videoHeight || 'N/A' }}</span></div>
          </div>
        </div>
        
        <div v-if="diagnostics.videoError" class="border-t border-red-900 pt-2 mt-2 text-red-400">
          <div>错误信息:</div>
          <div class="pl-2">
            <div>code: {{ diagnostics.videoError.code }}</div>
            <div>message: {{ diagnostics.videoError.message }}</div>
          </div>
        </div>
        
        <div v-if="diagnostics.lastError" class="border-t border-red-900 pt-2 mt-2 text-red-400">
          <div>最近错误:</div>
          <div class="pl-2 whitespace-pre-wrap">{{ diagnostics.lastError }}</div>
        </div>
      </div>
    </div>

    <!-- 诊断按钮 -->
    <button
      class="absolute bottom-2 right-2 z-10 px-2 py-1 bg-black/50 hover:bg-black/70 rounded text-white text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
      @click="toggleDiagnostics"
    >
      [诊断]
    </button>

    <!-- 加载状态 -->
    <div v-if="isConnecting" class="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div class="flex flex-col items-center gap-4">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div class="flex flex-col items-center gap-2">
          <p class="text-sm font-medium text-white">{{ retryCount > 0 ? '重新连接中...' : '正在加载...' }}</p>
          <p v-if="retryCount > 0" class="text-xs text-white/60">重试 #{{ retryCount }}</p>
        </div>
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
