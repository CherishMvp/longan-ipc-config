<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  playerCount: number
}>()

interface MemoryStats {
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
  arrayBuffers: number
  usedMB: number
  totalMB: number
}

const memoryStats = ref<MemoryStats | null>(null)
const cpuPercent = ref<number>(0)
const updateInterval = ref<number | null>(null)

async function getSystemStats(): Promise<{ memory: MemoryStats | null; cpu: number }> {
  let memory = null
  let cpu = 0

  // 1. Electron 环境：获取主进程内存 + CPU
  if (window.electronAPI?.getMemoryUsage) {
    try {
      const mem = await window.electronAPI.getMemoryUsage()
      memory = {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers || 0,
        usedMB: Math.round(mem.heapUsed / 1024 / 1024),
        totalMB: Math.round(mem.rss / 1024 / 1024)
      }
    } catch (error) {
      console.error('Failed to get memory:', error)
    }
  }

  // 2. 浏览器环境备用
  if (!memory) {
    const browserMemory = (performance as any).memory
    if (browserMemory) {
      memory = {
        rss: browserMemory.totalJSHeapSize,
        heapTotal: browserMemory.totalJSHeapSize,
        heapUsed: browserMemory.usedJSHeapSize,
        external: 0,
        arrayBuffers: 0,
        usedMB: Math.round(browserMemory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(browserMemory.jsHeapSizeLimit / 1024 / 1024)
      }
    }
  }

  // 3. CPU 占用（如果有 IPC）
  if (window.electronAPI?.getCPUUsage) {
    try {
      cpu = await window.electronAPI.getCPUUsage()
    } catch (error) {
      // Ignore
    }
  }

  return { memory, cpu }
}

async function updateStats() {
  const stats = await getSystemStats()
  memoryStats.value = stats.memory
  cpuPercent.value = stats.cpu
}

function getMemoryClass(mb: number): string {
  if (mb < 500) return 'bg-green-500'
  if (mb < 1000) return 'bg-yellow-500'
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
  <div class="flex items-center gap-3 text-xs font-mono">
    <!-- 播放路数 -->
    <div class="flex items-center gap-1.5">
      <span class="text-muted-foreground">播放:</span>
      <Badge variant="outline" class="font-mono">
        {{ playerCount }} 路
      </Badge>
    </div>
    
    <!-- 内存 -->
    <div v-if="memoryStats" class="flex items-center gap-1.5">
      <span class="text-muted-foreground">内存:</span>
      <Badge 
        variant="outline" 
        :class="getMemoryClass(memoryStats.totalMB)"
        class="font-mono"
      >
        {{ memoryStats.totalMB }} MB
      </Badge>
    </div>
    
    <!-- CPU -->
    <div v-if="cpuPercent > 0" class="flex items-center gap-1.5">
      <span class="text-muted-foreground">CPU:</span>
      <Badge 
        variant="outline" 
        :class="getCPUClass(cpuPercent)"
        class="font-mono"
      >
        {{ cpuPercent }}%
      </Badge>
    </div>
  </div>
</template>

<style scoped>
.font-mono {
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>