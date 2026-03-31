<script setup lang="ts">
import { ref, computed } from 'vue'
import StreamPlayer from '@/components/VideoPlayer/StreamPlayer.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface DeviceConfig {
  deviceId: string
  channelId: string
  priority: 'high' | 'normal' | 'low'
  playUrl: string
}

const props = defineProps<{
  devices: DeviceConfig[]
}>()

const layout = ref<'3x3' | '4x4'>('3x3')

const gridClass = computed(() => ({
  'grid-cols-3': layout.value === '3x3',
  'grid-cols-4': layout.value === '4x4'
}))

const totalStreams = computed(() => props.devices.length)
</script>

<template>
  <div class="w-full h-full p-4">
    <!-- 顶部工具栏 -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Live Video Wall</h2>
      <div class="flex items-center gap-2">
        <Select v-model="layout">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="Layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3x3">3×3 (9 路)</SelectItem>
            <SelectItem value="4x4">4×4 (16 路)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm">
          Fullscreen
        </Button>
      </div>
    </div>

    <!-- 视频网格 -->
    <div :class="['grid gap-3', gridClass]">
      <StreamPlayer
        v-for="(device, index) in devices"
        :key="index"
        :device-id="device.deviceId"
        :channel-id="device.channelId"
        :priority="device.priority"
        :play-url="device.playUrl"
      />
    </div>
  </div>
</template>

<style scoped>
.grid {
  @apply auto-rows-fr;
}
</style>
