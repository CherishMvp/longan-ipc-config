<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  playerCount: number
}>()

interface MemoryStats {
  rss: number         // 驻留集大小（总物理内存）
  heapTotal: number   // V8 堆总量
  heapUsed: number    // V8 堆使用量
  external: number    // C++ 对象内存
  arrayBuffers: number // ArrayBuffer 内存
  usedMB: number
  totalMB: number
}

const memoryStats = ref<MemoryStats | null>(null)
const updateInterval = ref<number | null>(null)

async function getElectronMemory(): Promise<MemoryStats | null> {
  try {
    // Electron 环境：通过 IPC 从主进程获取内存信息
    if (window.electronAPI?.getMemoryUsage) {
      const memory = await window.electronAPI.getMemoryUsage()
      return {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers || 0,
        usedMB: Math.round(memory.heapUsed / 1024 / 1024),
        totalMB: Math.round(memory.rss / 1024 / 1024)
      }
    }
    
    // 备用：Chrome/Edge 浏览器环境
    const memory = (performance as any).memory
    if (memory) {
      return {
        rss: memory.totalJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        heapUsed: memory.usedJSHeapSize,
        external: 0,
        arrayBuffers: 0,
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      }
    }
    
    return null
  } catch (error) {
    console.error('Failed to get memory stats:', error)
    return null
  }
}

async function updateStats() {
  memoryStats.value = await getElectronMemory()
}

function getMemoryClass(usedMB: number): string {
  if (usedMB < 500) return 'bg-green-500'
  if (usedMB < 1000) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getUsagePercent(): number {
  if (!memoryStats.value) return 0
  // 使用 RSS（驻留集大小）作为实际内存占用
  const percent = (memoryStats.value.heapUsed / memoryStats.value.rss) * 100
  return Math.min(100, Math.round(percent))
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
    
    <!-- 内存占用 -->
    <div v-if="memoryStats" class="flex items-center gap-1.5">
      <span class="text-muted-foreground">内存:</span>
      <Badge 
        variant="outline" 
        :class="getMemoryClass(memoryStats.usedMB)"
        class="font-mono"
      >
        {{ memoryStats.usedMB }} MB
      </Badge>
      <div class="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          class="h-full transition-all duration-500"
          :class="getMemoryClass(memoryStats.usedMB)"
          :style="{ width: `${getUsagePercent()}%` }"
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