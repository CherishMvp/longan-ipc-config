<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import mpegts from 'mpegts.js'

const props = defineProps<{
    streamUrl: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
let player: mpegts.Player | null = null
const isSilentConnecting = ref(false)
let reconnectTimer: any = null
let retryCount = 0

const initPlayer = async (isReconnect = false) => {
    if (!videoRef.value || !props.streamUrl) return
    
    // 如果是重连，销毁旧 player 但保留 video 标签的最后一帧，实现平滑无感
    if (player) {
        try {
            player.pause()
            player.unload()
            player.detachMediaElement()
            player.destroy()
        } catch (e) {}
        player = null
    }

    isSilentConnecting.value = true

    // 加上随机时间戳防止浏览器 WebSocket 缓存
    const wsUrl = `ws://localhost:9999?url=${encodeURIComponent(props.streamUrl)}&_=${Date.now()}`
    
    player = mpegts.createPlayer({
        type: 'flv',
        isLive: true,
        url: wsUrl,
        hasAudio: false,
    }, {
        enableWorker: true,           // 🚀 开启 Web Worker (多线程解码，防掉帧)
        enableStashBuffer: true,      // 🚀 开启缓存 (VLC 风格)
        stashInitialSize: 1536,       // 增大初始缓冲区 (1.5MB)
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 3.0,
        autoCleanupSourceBuffer: true,
        fixAudioTimestampGap: false,
    })

    player.attachMediaElement(videoRef.value)
    
    player.on(mpegts.Events.ERROR, (type, details, data) => {
        console.warn(`[VLC-Mode] Recoverable error: ${details}, retrying...`)
        handleSilentReconnect()
    })

    player.on(mpegts.Events.STATISTICS_INFO, () => {
        isSilentConnecting.value = false
        retryCount = 0 
    })

    try {
        player.load()
        const playPromise = player.play()
        if (playPromise && typeof (playPromise as any).catch === 'function') {
            (playPromise as Promise<void>).catch(() => {
                if (videoRef.value) videoRef.value.muted = true
                player?.play()
            })
        }
    } catch (e) {
        handleSilentReconnect()
    }
}

const handleSilentReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    retryCount++
    
    // 渐进式重连，前几次快，后面慢
    const delay = retryCount < 10 ? 1000 : 5000
    reconnectTimer = setTimeout(() => initPlayer(true), delay)
}

const destroyPlayer = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (player) {
        try {
            player.pause()
            player.unload()
            player.detachMediaElement()
            player.destroy()
        } catch (e) {}
        player = null
    }
}

onMounted(() => initPlayer())
onUnmounted(() => destroyPlayer())
watch(() => props.streamUrl, () => {
    retryCount = 0
    initPlayer()
})
</script>

<template>
    <div class="mpegts-player relative bg-black w-full h-full flex items-center justify-center overflow-hidden group">
        <!-- 核心视频层 -->
        <video 
            ref="videoRef" 
            class="w-full h-full object-contain"
            muted
            playsinline
            autoplay
        ></video>
        
        <!-- 极致轻量化的状态指示 (仅在网络极差时若隐若现) -->
        <div v-if="isSilentConnecting && retryCount > 2" class="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center transition-all duration-1000">
            <div class="flex flex-col items-center gap-2">
                <div class="w-1 h-8 bg-primary/40 rounded-full animate-bounce"></div>
                <span class="text-[8px] font-mono text-white/30 uppercase tracking-[0.2em]">Self-Healing #{{retryCount}}</span>
            </div>
        </div>

        <!-- Hover 时的信息条 (VLC 风格) -->
        <div class="absolute bottom-4 left-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
            <div class="px-2 py-1 bg-black/80 backdrop-blur-md border border-white/10 rounded text-[9px] font-mono text-white/60">
                <span class="text-green-500 mr-2">●</span> STABLE_GATEWAY | 1280x720 | H.264
            </div>
        </div>
    </div>
</template>

<style scoped>
.mpegts-player { cursor: none; }
.mpegts-player:hover { cursor: default; }
video { pointer-events: none; }
</style>
