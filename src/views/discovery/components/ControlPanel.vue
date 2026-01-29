<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Radar, Search, Loader2, Terminal } from 'lucide-vue-next'

const props = defineProps<{
  isScanning: boolean
  scanType: 'onvif' | 'range'
  ipStart: string
  ipEnd: string
  deviceCount: number
  logs: string[]
}>()

const emit = defineEmits<{
  (e: 'update:scanType', val: 'onvif' | 'range'): void
  (e: 'update:ipStart', val: string): void
  (e: 'update:ipEnd', val: string): void
  (e: 'start'): void
  (e: 'stop'): void
}>()

// Local proxies for v-model
const localIpStart = ref(props.ipStart)
const localIpEnd = ref(props.ipEnd)

watch(localIpStart, (val) => emit('update:ipStart', val))
watch(localIpEnd, (val) => emit('update:ipEnd', val))
</script>

<template>
  <Card class="flex flex-col h-full hidden lg:flex">
    <CardHeader>
      <CardTitle>扫描控制</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4 flex-1 flex flex-col">
      <div v-if="scanType === 'range'" class="space-y-2 p-3 bg-muted/50 rounded-lg">
        <label class="text-xs font-medium">IP 范围</label>
        <div class="flex items-center gap-2">
          <Input v-model="localIpStart" class="h-8 text-xs px-2" />
          <span>-</span>
          <Input v-model="localIpEnd" class="h-8 text-xs px-2" />
        </div>
      </div>

      <div class="py-4 flex flex-col items-center justify-center text-center space-y-2">
        <div :class="['w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500', isScanning ? 'bg-primary/10 animate-pulse' : 'bg-muted']">
          <Radar :class="['w-10 h-10', isScanning ? 'text-primary animate-spin-slow' : 'text-muted-foreground']" />
        </div>
        <div class="text-sm font-medium">
          {{ isScanning ? '正在扫描中...' : '准备就绪' }}
        </div>
        <div class="text-xs text-muted-foreground">
          已发现 {{ deviceCount }} 台设备
        </div>
      </div>

      <Button class="w-full" size="lg" @click="isScanning ? emit('stop') : emit('start')" :variant="isScanning ? 'destructive' : 'default'">
        <component :is="isScanning ? Loader2 : Search" :class="['w-4 h-4 mr-2', isScanning ? 'animate-spin' : '']" />
        {{ isScanning ? '停止扫描' : '开始扫描' }}
      </Button>

      <div class="flex-1"></div>
      
      <!-- Mini Terminal -->
      <div class="mt-auto border-t pt-4">
          <div class="bg-black/95 text-green-500 font-mono text-[10px] h-48 overflow-hidden flex flex-col rounded-lg border border-white/10">
          <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 text-white/50 bg-white/5">
            <Terminal class="w-3 h-3" />
            <span>SCAN LOGS</span>
          </div>
          <ScrollArea class="flex-1 p-2">
            <div v-for="(log, i) in logs" :key="i" class="opacity-80 break-all mb-1">
              {{ log }}
            </div>
          </ScrollArea>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 3s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
