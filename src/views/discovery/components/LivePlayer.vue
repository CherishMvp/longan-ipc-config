<script setup lang="ts">
import { ref, computed } from 'vue'
import { Camera, Video, Loader2, Maximize, RefreshCw } from 'lucide-vue-next'
import { useFullscreen } from '@vueuse/core'
import StreamPlayer from '@/components/VideoPlayer/StreamPlayer.vue'

const props = defineProps<{
  streamUrl?: string
  snapshotUrl?: string
  isLoading?: boolean
  isLive?: boolean
  deviceId?: string
  channelId?: string
}>()

const emit = defineEmits<{
  (e: 'toggle-live'): void
  (e: 'refresh-snapshot'): void
}>()

const playerRef = ref<HTMLElement | null>(null)
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(playerRef)

const showControls = ref(false)

const isRTSP = computed(() => props.streamUrl?.startsWith('rtsp://'))
const isMJPEG = computed(() => props.isLive && props.streamUrl && !isRTSP.value)

// Handle double click to fullscreen
const handleDblClick = () => {
  toggleFullscreen()
}
</script>

<template>
  <div 
    class="space-y-3 p-3 bg-muted/30 rounded-lg border group"
    @mouseenter="showControls = true"
    @mouseleave="showControls = false"
  >
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium flex items-center gap-2">
        <Camera class="w-4 h-4" /> 
        {{ isLive ? '实时监控' : '实时快照' }}
        <span v-if="isLive" class="flex h-2 w-2 relative">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      </span>
      <div class="flex gap-1">
        <button 
          class="p-1.5 rounded-md hover:bg-background transition-colors"
          @click="emit('toggle-live')" 
          :title="isLive ? '停止直播' : '开始直播'"
        >
          <Video class="w-3.5 h-3.5" :class="isLive ? 'text-red-500' : ''" />
        </button>
        <button 
          class="p-1.5 rounded-md hover:bg-background transition-colors"
          @click="emit('refresh-snapshot')" 
          :disabled="isLoading || isLive"
          title="刷新快照"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{'animate-spin': isLoading}" />
        </button>
        <button 
          class="p-1.5 rounded-md hover:bg-background transition-colors"
          @click="toggleFullscreen"
          title="全屏"
        >
          <Maximize class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    
    <div 
      ref="playerRef"
      class="relative aspect-video bg-black rounded-md overflow-hidden flex items-center justify-center border shadow-inner cursor-pointer"
      :class="{'fixed inset-0 z-50 rounded-none h-screen w-screen': isFullscreen}"
      @dblclick="handleDblClick"
    >
      <!-- WVP Stream Player (using mpegts.js) -->
      <StreamPlayer 
        v-if="isLive && isRTSP && streamUrl"
        :device-id="deviceId || 'unknown'"
        :channel-id="channelId || 'unknown'"
        :priority="normal"
        :play-url="streamUrl"
      />

      <!-- MJPEG Stream / Live -->
      <img 
        v-else-if="isMJPEG && streamUrl" 
        :src="streamUrl" 
        class="w-full h-full object-contain" 
        alt="Live Stream"
      />
      
      <!-- Snapshot / Fallback -->
      <img 
        v-else-if="snapshotUrl" 
        :src="snapshotUrl" 
        class="w-full h-full object-contain" 
        alt="Snapshot"
      />
      
      <!-- Loading State -->
      <div 
        v-if="isLoading && !isLive" 
        class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white backdrop-blur-sm"
      >
        <Loader2 class="w-8 h-8 animate-spin mb-2" />
        <span class="text-xs font-mono">LOADING...</span>
      </div>
      
      <!-- Empty State -->
      <div 
        v-else-if="!snapshotUrl && !streamUrl && !isLive" 
        class="flex flex-col items-center text-muted-foreground/30 pointer-events-none"
      >
        <Video class="w-12 h-12 mb-2 opacity-50" />
        <span class="text-[10px]">NO SIGNAL</span>
      </div>

      <!-- Fullscreen Controls Overlay -->
      <div 
        v-if="isFullscreen && showControls" 
        class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-end gap-2"
      >
        <button 
          class="p-2 bg-white/10 hover:bg-white/20 rounded text-white backdrop-blur-md"
          @click.stop="toggleFullscreen"
        >
          <Maximize class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure the player covers the container */
:deep(.mpegts-player) {
  width: 100%;
  height: 100%;
}
</style>
