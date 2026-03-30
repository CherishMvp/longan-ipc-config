<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import mpegts from 'mpegts.js'

const props = defineProps<{
    streamUrl: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
let player: mpegts.Player | null = null
const isConnecting = ref(false)
const error = ref<string | null>(null)

const initPlayer = () => {
    if (!videoRef.value || !props.streamUrl) return
    
    destroyPlayer()
    isConnecting.value = true
    error.value = null

    // Connect to the local WebSocket stream service
    const wsUrl = `ws://localhost:9999?url=${encodeURIComponent(props.streamUrl)}`
    
    player = mpegts.createPlayer({
        type: 'flv',
        isLive: true,
        url: wsUrl,
        hasAudio: false,
    }, {
        enableStashBuffer: false, // Low latency
        liveBufferLatencyChasing: true,
        autoCleanupSourceBuffer: true
    })

    player.attachMediaElement(videoRef.value)
    
    player.on(mpegts.Events.ERROR, (type, details, data) => {
        console.error('Mpegts Error:', type, details, data)
        error.value = `播放错误: ${details}`
        isConnecting.value = false
    })

    player.on(mpegts.Events.STATISTICS_INFO, () => {
        if (isConnecting.value) {
            isConnecting.value = false
        }
    })

    try {
        player.load()
        const playPromise = player.play()
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.error('Auto play failed:', e)
            })
        }
    } catch (e: any) {
        error.value = `启动失败: ${e.message}`
        isConnecting.value = false
    }
}

const destroyPlayer = () => {
    if (player) {
        player.pause()
        player.unload()
        player.detachMediaElement()
        player.destroy()
        player = null
    }
}

onMounted(() => {
    initPlayer()
})

onUnmounted(() => {
    destroyPlayer()
})

watch(() => props.streamUrl, () => {
    initPlayer()
})
</script>

<template>
    <div class="mpegts-player relative bg-black rounded-lg overflow-hidden flex items-center justify-center w-full h-full border shadow-inner">
        <video 
            ref="videoRef" 
            class="w-full h-full object-contain"
            muted
            playsinline
        ></video>
        
        <!-- Loading Overlay -->
        <div v-if="isConnecting && !error" class="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm text-white">
            <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
            <span class="text-xs font-mono">STREAMING...</span>
        </div>

        <!-- Error Overlay -->
        <div v-if="error" class="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-sm text-red-400 p-4 text-center">
            <div class="text-xs font-bold mb-1">STREAM ERROR</div>
            <div class="text-[10px] opacity-80 break-all">{{ error }}</div>
            <button @click="initPlayer" class="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/40 rounded text-[10px] transition-colors border border-red-500/50">
                RETRY
            </button>
        </div>

        <div v-if="!streamUrl && !error" class="text-muted-foreground text-sm">
            等待流地址...
        </div>
    </div>
</template>

<style scoped>
.mpegts-player {
    min-height: 200px;
}
video {
    outline: none;
}
</style>
