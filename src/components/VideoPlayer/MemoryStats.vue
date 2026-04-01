<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  playerCount: number
}>()

interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  usedMB: number
  totalMB: number
  limitMB: number
  usagePercent: number
}

const memoryStats = ref<MemoryStats | null>(null)
const cpuUsage = ref<number>(0)
let updateInterval: number | null = null
let lastTime = performance.now()

function getMemoryStats(): MemoryStats | null {
  // Chrome/Edge 支持 performance.memory
  const memory = (performance as any).memory
  if (!memory) {
    return null
  }
  
  const usedJSHeapSize = memory.usedJSHeapSize
  const totalJSHeapSize = memory.totalJSHeapSize
  const jsHeapSizeLimit = memory.jsHeapSizeLimit
  
  return {
    usedJSHeapSize,
    totalJSHeapSize,
    jsHeapSizeLimit,
    usedMB: Math.round(usedJSHeapSize / 1024 / 1024),
    totalMB: Math.round(totalJSHeapSize / 1024 / 1024),
    limitMB: Math.round(jsHeapSizeLimit / 1024 / 1024),
    usagePercent: Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100)
  }
}

function updateStats() {
  memoryStats.value = getMemoryStats()
  
  // 简单的 CPU 占用估算（基于主线程任务执行时间）
  const now = performance.now()
  const elapsed = now - lastTime
  const cpuTime = performance.now() - now
  
  if (elapsed > 0) {
    // 近似 CPU 占用率（非常粗略的估算）
    cpuUsage.value = Math.min(100, Math.round((cpuTime / elapsed) * 100))
  }
  
  lastTime = now
}

function getMemoryClass(percent: number): string {
  if (percent < 50) return 'bg-green-500'
  if (percent < 75) return 'bg-yellow-500'
  return 'bg-red-500'
}

onMounted(() => {
  updateStats()
  updateInterval = window.setInterval(updateStats, 2000)
})

onBeforeUnmount(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
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
    
    <!-- 内存占用 -->
    <div v-if="memoryStats" class="flex items-center gap-1.5">
      <span class="text-muted-foreground">内存:</span>
      <Badge 
        variant="outline" 
        :class="getMemoryClass(memoryStats.usagePercent)"
        class="font-mono"
      >
        {{ memoryStats.usedMB }} / {{ memoryStats.limitMB }} MB
      </Badge>
      <div class="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          class="h-full transition-all duration-500"
          :class="getMemoryClass(memoryStats.usagePercent)"
          :style="{ width: `${memoryStats.usagePercent}%` }"
        />
      </div>
    </div>
    
    <!-- 不支持内存 API 的提示 -->
    <div v-else class="flex items-center gap-1.5">
      <span class="text-muted-foreground">内存:</span>
      <Badge variant="outline" class="font-mono text-muted-foreground">
        N/A
      </Badge>
    </div>
  </div>
</template>

<style scoped>
.font-mono {
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>