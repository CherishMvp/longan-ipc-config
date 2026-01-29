<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Monitor, Video, Check } from 'lucide-vue-next'
import type { DiscoveredDevice } from '@/types/electron'

const props = defineProps<{
  devices: DiscoveredDevice[]
  selectedDevice: DiscoveredDevice | null
  selectedIds: Set<string>
  isExisting: (d: DiscoveredDevice) => boolean
}>()

const emit = defineEmits<{
  (e: 'select', device: DiscoveredDevice): void
  (e: 'toggle-selection', device: DiscoveredDevice): void
  (e: 'add-selected'): void
}>()
</script>

<template>
  <Card class="flex flex-col h-full bg-muted/20 border-l-0 border-r-0 rounded-none shadow-none">
    <CardHeader class="pb-2">
      <div class="flex items-center justify-between">
        <CardTitle>扫描结果</CardTitle>
        <div class="flex gap-2" v-if="selectedIds.size > 0">
          <Button size="sm" @click="emit('add-selected')">
            <Plus class="w-4 h-4 mr-2" />
            添加选中 ({{ selectedIds.size }})
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="flex-1 overflow-auto p-4">
      <div v-if="devices.length === 0" class="h-full flex flex-col items-center justify-center text-muted-foreground/50">
        <Monitor class="w-16 h-16 mb-4 opacity-20" />
        <p>暂无发现设备</p>
      </div>
      
      <div v-else class="grid gap-4" :class="selectedDevice ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'">
        <div 
          v-for="device in devices" 
          :key="device.ip"
          class="group relative bg-card border rounded-lg p-4 transition-all hover:shadow-md cursor-pointer"
          :class="[
            {'ring-2 ring-primary': selectedIds.has(device.ip), 'opacity-60 grayscale': isExisting(device)},
            selectedDevice?.ip === device.ip ? 'border-primary ring-1 ring-primary' : ''
          ]"
          @click="emit('select', device)"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="p-2 rounded-md bg-secondary text-secondary-foreground">
              <Video class="w-5 h-5" />
            </div>
            <div class="flex gap-1">
                <Badge :variant="device.type === 'onvif' ? 'default' : 'secondary'" class="text-[10px] uppercase">
                {{ device.type }}
                </Badge>
            </div>
          </div>
          
          <h3 class="font-semibold truncate" :title="device.name">{{ device.name }}</h3>
          <div class="text-sm text-muted-foreground font-mono mt-1">{{ device.ip }}</div>
          
          <div class="mt-4 pt-3 border-t text-xs text-muted-foreground flex justify-between items-center">
            <span class="truncate max-w-[120px]">{{ device.manufacturer }}</span>
            <span v-if="isExisting(device)" class="text-green-500 flex items-center gap-1">
              <Check class="w-3 h-3" /> 已添加
            </span>
          </div>

          <!-- Selection Checkbox -->
          <div v-if="!isExisting(device)" class="absolute top-4 right-4" @click.stop="emit('toggle-selection', device)">
            <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
              :class="selectedIds.has(device.ip) ? 'bg-primary border-primary' : 'border-muted-foreground/30 bg-background'"
            >
              <Check v-if="selectedIds.has(device.ip)" class="w-3 h-3 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
