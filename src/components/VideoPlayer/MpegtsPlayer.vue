<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import mpegts from 'mpegts.js'

const props = defineProps<{
    streamUrl: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
let player: mpegts.Player | null = null
const isSilentConnecting = ref(false)
const hasPermanentError = ref(false)
let reconnectTimer: any = null
let retryCount = 0
const MAX_SILENT_RETRIES = 50 // 极高次数的静默重试

const initPlayer = async (isReconnect = false) => {
    if (!videoRef.value || !props.streamUrl) return
    
    // 如果是重连，保持 video 标签现状，不清理 src，实现无感切换
    if (!isReconnect) {
        destroyPlayer()
        hasPermanentError.value = false
    } else {
        if (player) {
            player.pause()
            player.unload()
            player.detachMediaElement()
            player.destroy()
            player = null
        }
    }

    isSilentConnecting.value = true

    const wsUrl = `ws://localhost:9999?url=${encodeURIComponent(props.streamUrl)}`
    
    player = mpegts.createPlayer({
        type: 'flv',
        isLive: true,
        url: wsUrl,
        hasAudio: false,
    }, {
        enableStashBuffer: true,
        stashInitialSize: 1024, // 增加初始缓冲区，对标 VLC 稳定性
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 2.0, // 最大允许 2 秒延迟
        liveBufferLatencyMinLatency: 0.8, // 最小保持 0.8 秒缓存，确保不卡顿
        autoCleanupSourceBuffer: true,
    })

    player.attachMediaElement(videoRef.value)
    
    player.on(mpegts.Events.ERROR, (type, details, data) => {
        console.warn('[Player] Silent error handling:', details)
        handleSilentReconnect()
    })

    player.on(mpegts.Events.STATISTICS_INFO, () => {
        isSilentConnecting.value = false
        retryCount = 0 
    })

    try {
        player.load()
        const playPromise = player.play()
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // 静默处理自动播放限制
                if (videoRef.value) videoRef.value.muted = true
                player?.play()
            })
        }
    } catch (e) {
        handleSilentReconnect()
    }
}

const handleSilentReconnect = () => {
    if (retryCount >= MAX_SILENT_RETRIES) {
        hasPermanentError.value = true
        isSilentConnecting.value = false
        return
    }

    if (reconnectTimer) clearTimeout(reconnectTimer)
    
    retryCount++
    // 像 VLC 一样，重连间隔随次数增加，但保持前端无感
    const delay = retryCount < 5 ? 1000 : 3000
    
    reconnectTimer = setTimeout(() => {
        initPlayer(true)
    }, delay)
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
    <div class="mpegts-player relative bg-[#050505] w-full h-full flex items-center justify-center overflow-hidden group">
        <!-- 视频主体：永远保持存在，不随状态移除 -->
        <video 
            ref="videoRef" 
            class="w-full h-full object-contain transition-opacity duration-1000"
            :class="{ 'opacity-40': isSilentConnecting && retryCount > 5 }"
            muted
            playsinline
            autoplay
        ></video>
        
        <!-- 极其隐蔽的加载指示器 (仅在重连多次后显示，且位于角落) -->
        <div v-if="isSilentConnecting && retryCount > 1" class="absolute top-3 right-3 flex items-center gap-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 animate-in fade-in duration-500">
            <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span class="text-[10px] font-medium text-white/70 uppercase tracking-tighter">Recovering...</span>
        </div>

        <!-- 只有在彻底挂掉时才显示的报错 -->
        <div v-if="hasPermanentError" class="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl text-white p-6 text-center">
            <div class="text-xs opacity-50 mb-4 font-mono">CONNECTION_LOST_MAX_RETRY</div>
            <button @click="retryCount = 0; initPlayer()" class="px-6 py-2 border border-white/20 hover:bg-white hover:text-black transition-all text-xs tracking-widest">
                FORCE_RELOAD
            </button>
        </div>

        <!-- VLC 风格的悬浮信息 (仅 Hover 显示) -->
        <div class="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
            <div class="flex items-center gap-3 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded border border-white/5 shadow-2xl">
                <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span class="text-[10px] font-mono text-white/80 uppercase">Live Stream | 720p</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.mpegts-player {
    cursor: none; /* 播放器内部隐藏鼠标，对标 VLC 全屏感 */
}
.mpegts-player:hover {
    cursor: default;
}
video::-webkit-media-controls {
    display: none !important;
}
</style>
