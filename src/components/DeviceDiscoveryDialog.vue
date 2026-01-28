<script setup lang="ts">
import { ref, onUnmounted, computed, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Radar, 
  Search, 
  Loader2, 
  Plus, 
  Check, 
  Wifi
} from 'lucide-vue-next'
import { useDeviceStore } from '@/stores/device'
import type { DiscoveredDevice } from '@/types/electron'

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'add-devices', devices: any[]): void
}>()

const store = useDeviceStore()
const isScanning = ref(false)
const scanType = ref<'onvif' | 'range'>('onvif')
const discoveredDevices = ref<DiscoveredDevice[]>([])
const selectedDevices = ref<Set<string>>(new Set()) // Store UUIDs or IPs
const ipRangeStart = ref('192.168.1.1')
const ipRangeEnd = ref('192.168.1.254')

// Cleanup function for event listener
let cleanupListener: (() => void) | null = null

const isOpen = computed({
  get: () => props.open,
  set: (val) => {
    emit('update:open', val)
    if (!val) stopScan()
  }
})

// Check if device is already in store
const isExisting = (device: DiscoveredDevice) => {
  return store.devices.some(d => d.ip === device.ip)
}

const toggleSelection = (device: DiscoveredDevice) => {
  if (isExisting(device)) return
  
  if (selectedDevices.value.has(device.ip)) {
    selectedDevices.value.delete(device.ip)
  } else {
    selectedDevices.value.add(device.ip)
  }
}

const selectAll = () => {
  const available = discoveredDevices.value.filter(d => !isExisting(d))
  if (selectedDevices.value.size === available.length) {
    selectedDevices.value.clear()
  } else {
    available.forEach(d => selectedDevices.value.add(d.ip))
  }
}

const startScan = async () => {
  if (isScanning.value) return
  
  discoveredDevices.value = []
  selectedDevices.value.clear()
  isScanning.value = true

  if (window.electronAPI) {
    // Setup listener
    if (cleanupListener) cleanupListener()
    cleanupListener = window.electronAPI.onDeviceFound((device) => {
      // De-duplicate by IP
      const index = discoveredDevices.value.findIndex(d => d.ip === device.ip)
      if (index === -1) {
        discoveredDevices.value.push(device)
      } else {
        // Update info if needed
        discoveredDevices.value[index] = { ...discoveredDevices.value[index], ...device }
      }
    })

    await window.electronAPI.startScan({ 
      type: scanType.value,
      range: scanType.value === 'range' ? { start: ipRangeStart.value, end: ipRangeEnd.value } : undefined
    })
  } else {
    // 移除 Mock 数据，改为提示用户
    // Mock data removed to avoid confusion
    console.warn('[Discovery] Electron API not found. Please run in Electron environment.')
    store.addLog('warning', '未检测到 Electron 环境，无法执行真实扫描')
  }
}

const stopScan = async () => {
  if (!isScanning.value) return
  isScanning.value = false
  
  if (window.electronAPI) {
    await window.electronAPI.stopScan()
    if (cleanupListener) {
      cleanupListener()
      cleanupListener = null
    }
  }
}

const handleAddSelected = () => {
  const toAdd = discoveredDevices.value.filter(d => selectedDevices.value.has(d.ip))
  emit('add-devices', toAdd)
  isOpen.value = false
  selectedDevices.value.clear()
}

// Watch dialog open state to reset or start?
// No, let user start manually. But we should stop on close.
watch(() => props.open, (val) => {
  if (!val) stopScan()
})

onUnmounted(() => {
  stopScan()
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[800px] flex flex-col h-[80vh]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Radar class="w-5 h-5 text-primary" />
          设备自动发现
        </DialogTitle>
        <DialogDescription>
          扫描局域网内的 IPC 设备 (支持 ONVIF 协议)
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col flex-1 min-h-0 gap-4 py-4">
        <!-- Controls -->
        <div class="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border">
          <div class="flex items-center gap-2 bg-background p-1 rounded-md border">
            <Button 
              size="sm" 
              variant="ghost" 
              :class="[scanType === 'onvif' ? 'bg-primary/10 text-primary' : '']"
              @click="scanType = 'onvif'"
            >
              <Wifi class="w-4 h-4 mr-2" />
              局域网广播 (ONVIF)
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              :class="[scanType === 'range' ? 'bg-primary/10 text-primary' : '']"
              @click="scanType = 'range'"
            >
              <Search class="w-4 h-4 mr-2" />
              网段扫描
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <div v-if="isScanning" class="flex items-center gap-2 text-sm text-primary animate-pulse mr-2">
              <Loader2 class="w-4 h-4 animate-spin" />
              正在扫描...
            </div>
            <Button v-if="!isScanning" @click="startScan" size="sm">
              开始扫描
            </Button>
            <Button v-else variant="destructive" size="sm" @click="stopScan">
              停止
            </Button>
          </div>
        </div>

        <!-- IP Range Inputs (Conditional) -->
        <div v-if="scanType === 'range'" class="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border">
          <Input v-model="ipRangeStart" placeholder="起始 IP" class="w-40" />
          <span class="text-muted-foreground">-</span>
          <Input v-model="ipRangeEnd" placeholder="结束 IP" class="w-40" />
        </div>

        <!-- Results List -->
        <div class="flex-1 border rounded-md overflow-hidden bg-background flex flex-col">
          <!-- Header -->
          <div class="flex items-center p-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
            <div class="w-10 flex justify-center">
              <input 
                type="checkbox" 
                class="rounded border-gray-300" 
                :checked="selectedDevices.size > 0 && selectedDevices.size === discoveredDevices.filter(d => !isExisting(d)).length"
                @change="selectAll"
                :disabled="discoveredDevices.filter(d => !isExisting(d)).length === 0"
              />
            </div>
            <div class="w-40">IP 地址</div>
            <div class="flex-1">设备名称 / 厂商</div>
            <div class="w-32">状态</div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-0">
            <div v-if="discoveredDevices.length === 0" class="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Radar class="w-8 h-8 opacity-20" />
              </div>
              <p v-if="isScanning">正在搜索设备...</p>
              <p v-else>点击“开始扫描”寻找设备</p>
            </div>

            <div v-else>
              <div 
                v-for="device in discoveredDevices" 
                :key="device.ip"
                class="flex items-center p-3 border-b last:border-0 hover:bg-muted/30 transition-colors"
                :class="{'bg-primary/5': selectedDevices.has(device.ip)}"
              >
                <div class="w-10 flex justify-center">
                  <input 
                    type="checkbox" 
                    class="rounded border-gray-300"
                    :checked="selectedDevices.has(device.ip)"
                    :disabled="isExisting(device)"
                    @change="toggleSelection(device)"
                  />
                </div>
                <div class="w-40 font-mono text-sm">{{ device.ip }}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ device.name }}</div>
                  <div class="text-xs text-muted-foreground truncate">{{ device.manufacturer }} · {{ device.uuid }}</div>
                </div>
                <div class="w-32">
                  <Badge v-if="isExisting(device)" variant="secondary" class="text-xs">
                    <Check class="w-3 h-3 mr-1" /> 已添加
                  </Badge>
                  <Badge v-else variant="outline" class="text-xs text-green-600 border-green-200 bg-green-50">
                    <Wifi class="w-3 h-3 mr-1" /> 可添加
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <div class="flex items-center justify-between w-full">
          <div class="text-sm text-muted-foreground">
            已发现 {{ discoveredDevices.length }} 台设备，选中 {{ selectedDevices.size }} 台
          </div>
          <div class="flex gap-2">
            <Button variant="outline" @click="isOpen = false">关闭</Button>
            <Button :disabled="selectedDevices.size === 0" @click="handleAddSelected">
              <Plus class="w-4 h-4 mr-2" />
              批量添加
            </Button>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
