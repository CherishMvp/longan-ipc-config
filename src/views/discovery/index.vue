<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/device'
import { Radar, Search, Wifi } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { DiscoveredDevice } from '@/types/electron'

import ControlPanel from './components/ControlPanel.vue'
import DeviceList from './components/DeviceList.vue'
import DetailPanel from './components/DetailPanel.vue'

const store = useDeviceStore()

// --- State ---
const isScanning = ref(false)
const scanType = ref<'onvif' | 'range'>('onvif')
const ipRangeStart = ref('192.168.1.1')
const ipRangeEnd = ref('192.168.1.254')

const discoveredDevices = ref<DiscoveredDevice[]>([])
const selectedDevices = ref<Set<string>>(new Set())
const selectedDevice = ref<DiscoveredDevice | null>(null)
const scanLogs = ref<string[]>([])

let cleanupListener: (() => void) | null = null

// --- Actions ---

const addLog = (msg: string) => {
  const time = new Date().toLocaleTimeString()
  scanLogs.value.unshift(`[${time}] ${msg}`)
  if (scanLogs.value.length > 50) scanLogs.value.pop()
}

const startScan = async () => {
  if (isScanning.value) return
  
  discoveredDevices.value = []
  selectedDevices.value.clear()
  scanLogs.value = []
  isScanning.value = true
  addLog('开始扫描设备...')

  if (window.electronAPI) {
    if (cleanupListener) cleanupListener()
    
    cleanupListener = window.electronAPI.onDeviceFound((device: any) => {
      const index = discoveredDevices.value.findIndex(d => d.ip === device.ip)
      if (index === -1) {
        discoveredDevices.value.push(device)
        addLog(`发现设备: ${device.ip} (${device.name})`)
      } else {
        if (device.type === 'onvif' && discoveredDevices.value[index].type !== 'onvif') {
             discoveredDevices.value[index] = { ...discoveredDevices.value[index], ...device }
        }
      }
    })

    await window.electronAPI.startScan({ 
      type: scanType.value,
      range: scanType.value === 'range' ? { start: ipRangeStart.value, end: ipRangeEnd.value } : undefined
    })
  } else {
    addLog('错误: 未检测到 Electron 环境')
    isScanning.value = false
  }
}

const stopScan = async () => {
  if (!isScanning.value) return
  isScanning.value = false
  addLog('停止扫描')
  if (window.electronAPI) {
    await window.electronAPI.stopScan()
    if (cleanupListener) {
      cleanupListener()
      cleanupListener = null
    }
  }
}

const handleAddSelected = async () => {
  const toAdd = discoveredDevices.value.filter(d => selectedDevices.value.has(d.ip))
  let count = 0
  for (const d of toAdd) {
    try {
      await store.addDevice({ name: d.name, ip: d.ip, authId: '1' })
      count++
    } catch (e) { console.error(e) }
  }
  addLog(`成功添加 ${count} 台设备`)
  selectedDevices.value.clear()
}

const toggleSelection = (device: DiscoveredDevice) => {
  if (isExisting(device)) return
  if (selectedDevices.value.has(device.ip)) selectedDevices.value.delete(device.ip)
  else selectedDevices.value.add(device.ip)
}

const isExisting = (d: DiscoveredDevice) => store.devices.some(dev => dev.ip === d.ip)

onUnmounted(() => stopScan())
</script>

<template>
  <div class="h-full flex flex-col gap-6 p-2 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between shrink-0">
      <div>
        <h2 class="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Radar class="w-6 h-6 text-primary" /> 设备自动发现
        </h2>
        <p class="text-muted-foreground">基于 ONVIF 和 私有协议扫描局域网内的 IPC 设备</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :class="{'bg-accent': scanType === 'onvif'}" @click="scanType = 'onvif'">
          <Wifi class="w-4 h-4 mr-2" /> 智能扫描
        </Button>
        <Button variant="outline" :class="{'bg-accent': scanType === 'range'}" @click="scanType = 'range'">
          <Search class="w-4 h-4 mr-2" /> 网段扫描
        </Button>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="flex-1 grid gap-6 min-h-0 transition-all duration-300" :class="selectedDevice ? 'grid-cols-1 lg:grid-cols-[250px_1fr_400px]' : 'grid-cols-1 lg:grid-cols-[250px_1fr]'">
      
      <!-- Left: Control -->
      <ControlPanel 
        v-model:scanType="scanType"
        v-model:ipStart="ipRangeStart"
        v-model:ipEnd="ipRangeEnd"
        :is-scanning="isScanning"
        :device-count="discoveredDevices.length"
        :logs="scanLogs"
        @start="startScan"
        @stop="stopScan"
      />

      <!-- Middle: List -->
      <DeviceList 
        :devices="discoveredDevices"
        :selected-device="selectedDevice"
        :selected-ids="selectedDevices"
        :is-existing="isExisting"
        @select="selectedDevice = $event"
        @toggle-selection="toggleSelection"
        @add-selected="handleAddSelected"
      />

      <!-- Right: Detail -->
      <DetailPanel 
        v-if="selectedDevice"
        :device="selectedDevice"
        @close="selectedDevice = null"
        @log="addLog"
      />
    </div>
  </div>
</template>
