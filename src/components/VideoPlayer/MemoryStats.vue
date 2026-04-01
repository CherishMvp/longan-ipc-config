<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  playerCount: number
}>()

interface SystemStats {
  rendererMemory: number    // 渲染进程内存
  mainMemory: number        // 主进程内存
  gpuMemory: number         // GPU 内存
  cpuPercent: number        // CPU 占用百分比
  totalMemory: number       // 总内存
}

const stats = ref<SystemStats>({
  rendererMemory: 0,
  mainMemory: 0,
  gpuMemory: 0,
  cpuPercent: 0,
  totalMemory: 0
})

const updateInterval = ref<number | null>(null)

async function getSystemStats(): Promise<SystemStats> {
  let rendererMemory = 0
  let mainMemory = 0
  let gpuMemory = 0
  let cpuPercent = 0
  let totalMemory = 0

  // 1. 渲染进程内存
  const browserMemory = (performance as any).memory
  if (browserMemory) {
    rendererMemory = Math.round(browserMemory.usedJSHeapSize / 1024 / 1024)
    totalMemory = Math.round(browserMemory.jsHeapSizeLimit / 1024 / 1024)
  }

  // 2. 主进程和系统内存
  if (window.electronAPI?.getSystemStats) {
    try {
      const systemStats = await window.electronAPI.getSystemStats()
      mainMemory = Math.round(systemStats.mainMemory / 1024 / 1024)
      gpuMemory = Math.round(systemStats.gpuMemory / 1024 / 1024)
      cpuPercent = systemStats.cpuPercent || 0
    } catch (error) {
      console.error('Failed to get system stats:', error)
    }
  }

  return {
    rendererMemory,
    mainMemory,
    gpuMemory,
    cpuPercent,
    totalMemory
  }
}

async function updateStats() {
  stats.value = await getSystemStats()
}

function getMemoryClass(memoryMB: number): string {
  if (memoryMB < 300) return 'bg-green-500'
  if (memoryMB < 800) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getCPUClass(percent: number): string {
  if (percent < 30) return 'bg-green-500'
  if (percent < 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

onMounted(() => {
  updateStats()
  updateInterval.value = window.setInterval(updateStats, 2000)
})

onBeforeUnmount(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value)
  }
})
</script>

<template>
  <div class="flex items-center gap-4 text-xs font-mono">
    <!-- 播放路数 -->
    <div class="flex items-center gap-1.5">
      <span class="text-muted-foreground">播放:</span>
      <Badge variant="outline" class="font-mono">
        {{ playerCount }} 路
      </Badge>
    </div>
    
    <!-- 渲染进程内存 -->
    <div class="flex items-center gap-1.5">
      <span class="text-muted-foreground">渲染:</span>
      <Badge 
        variant="outline" 
        :class="getMemoryClass(stats.rendererMemory)"
        class="font-mono"
      >
        {{ stats.rendererMemory }} MB
      </Badge>
    </div>

    <!-- 主进程内存 -->
    <div class="flex items-center gap-1.5">
      <span class="text-muted-foreground">主进程:</span>
      <Badge 
        variant="outline" 
        :class="getMemoryClass(stats.mainMemory)"
        class="font-mono"
      >
        {{ stats.mainMemory }} MB
      </Badge>
    </div>

    <!-- GPU 内存 -->
    <div v-if="stats.gpuMemory > 0" class="flex items-center gap-1.5">
      <span class="text-muted-foreground">GPU:</span>
      <Badge 
        variant="outline" 
        :class="getMemoryClass(stats.gpuMemory)"
        class="font-mono"
      >
        {{ stats.gpuMemory }} MB
      </Badge>
    </div>
    
    <!-- CPU 占用 -->
    <div class="flex items-center gap-1.5">
      <span class="text-muted-foreground">CPU:</span>
      <Badge 
        variant="outline" 
        :class="getCPUClass(stats.cpuPercent)"
        class="font-mono"
      >
        {{ stats.cpuPercent }}%
      </Badge>
    </div>
  </div>
</template>

<style scoped>
.font-mono {
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>