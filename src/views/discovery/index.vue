<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/device'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  Radar, 
  Search, 
  Loader2, 
  Plus, 
  Check, 
  Wifi, 
  Monitor,
  Video,
  Terminal,
  Settings,
  X,
  Lock,
  RefreshCw,
  Save,
  Network
} from 'lucide-vue-next'
import type { DiscoveredDevice } from '@/types/electron'

const store = useDeviceStore()
const isScanning = ref(false)
const scanType = ref<'onvif' | 'range'>('onvif')
const ipRangeStart = ref('192.168.1.1')
const ipRangeEnd = ref('192.168.1.254')

const discoveredDevices = ref<DiscoveredDevice[]>([])
const selectedDevices = ref<Set<string>>(new Set())
const scanLogs = ref<string[]>([])

// Detail Panel State
const selectedDevice = ref<DiscoveredDevice | null>(null)
const isLoggingIn = ref(false)
const isLoggedIn = ref(false)
const loginForm = ref({ username: 'admin', password: '' })
const networkLoading = ref(false)
const networkConfig = ref({
  token: '',
  dhcp: false,
  ip: '',
  subnet: '',
  gateway: ''
})

// Cleanup function
let cleanupListener: (() => void) | null = null

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

const selectDevice = (device: DiscoveredDevice) => {
  selectedDevice.value = device
  isLoggedIn.value = false
  loginForm.value = { username: 'admin', password: '' }
  networkConfig.value = { token: '', dhcp: false, ip: '', subnet: '', gateway: '' }
}

const handleLogin = async () => {
  if (!selectedDevice.value) return
  isLoggingIn.value = true
  
  // Use GetNetworkInterfaces as a test for login
  try {
    const url = selectedDevice.value.xaddrs || `http://${selectedDevice.value.ip}/onvif/device_service`
    const res = await window.electronAPI.getNetworkSettings({
      url,
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    
    if (res.success && res.config) {
      isLoggedIn.value = true
      networkConfig.value = {
        token: res.token || '',
        ...res.config
      }
      addLog(`登录成功: ${selectedDevice.value.ip}`)
    } else {
      addLog(`登录失败: ${res.error}`)
    }
  } catch (e: any) {
    addLog(`登录错误: ${e.message}`)
  } finally {
    isLoggingIn.value = false
  }
}

const handleRefreshNetwork = async () => {
  handleLogin() // Re-fetch
}

const handleSaveNetwork = async () => {
  if (!selectedDevice.value) return
  networkLoading.value = true
  
  try {
    const url = selectedDevice.value.xaddrs || `http://${selectedDevice.value.ip}/onvif/device_service`
    const res = await window.electronAPI.setNetworkSettings({
      url,
      token: networkConfig.value.token,
      config: {
        dhcp: networkConfig.value.dhcp,
        ip: networkConfig.value.ip,
        subnet: networkConfig.value.subnet,
        gateway: networkConfig.value.gateway
      },
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    
    if (res.success) {
      addLog(`网络配置下发成功，设备可能需要重启`)
    } else {
      addLog(`配置失败: ${res.error}`)
    }
  } catch (e: any) {
    addLog(`配置错误: ${e.message}`)
  } finally {
    networkLoading.value = false
  }
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

const addLog = (msg: string) => {
  const time = new Date().toLocaleTimeString()
  scanLogs.value.unshift(`[${time}] ${msg}`)
  if (scanLogs.value.length > 50) scanLogs.value.pop()
}

const handleAddSelected = async () => {
  const toAdd = discoveredDevices.value.filter(d => selectedDevices.value.has(d.ip))
  let count = 0
  for (const d of toAdd) {
    try {
      await store.addDevice({
        name: d.name,
        ip: d.ip,
        authId: '1'
      })
      count++
    } catch (e) {
      console.error(e)
    }
  }
  addLog(`成功添加 ${count} 台设备`)
  selectedDevices.value.clear()
}

onUnmounted(() => {
  stopScan()
})
</script>

<template>
  <div class="h-full flex flex-col gap-6 p-2 overflow-hidden">
    <!-- Header Area -->
    <div class="flex items-center justify-between shrink-0">
      <div>
        <h2 class="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Radar class="w-6 h-6 text-primary" />
          设备自动发现
        </h2>
        <p class="text-muted-foreground">
          基于 ONVIF 和 私有协议扫描局域网内的 IPC 设备
        </p>
      </div>
      <div class="flex gap-2">
        <Button 
          variant="outline" 
          :class="{'bg-accent': scanType === 'onvif'}"
          @click="scanType = 'onvif'"
        >
          <Wifi class="w-4 h-4 mr-2" />
          智能扫描
        </Button>
        <Button 
          variant="outline"
          :class="{'bg-accent': scanType === 'range'}"
          @click="scanType = 'range'"
        >
          <Search class="w-4 h-4 mr-2" />
          网段扫描
        </Button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 grid gap-6 min-h-0" :class="selectedDevice ? 'grid-cols-1 lg:grid-cols-[250px_1fr_350px]' : 'grid-cols-1 lg:grid-cols-[250px_1fr]'">
      
      <!-- Left Control Panel -->
      <Card class="flex flex-col h-full">
        <CardHeader>
          <CardTitle>扫描控制</CardTitle>
          <CardDescription>配置扫描参数</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4 flex-1 flex flex-col">
          <div v-if="scanType === 'range'" class="space-y-2 p-3 bg-muted/50 rounded-lg">
            <label class="text-xs font-medium">IP 范围</label>
            <div class="flex items-center gap-2">
              <Input v-model="ipRangeStart" class="h-8 text-xs px-2" />
              <span>-</span>
              <Input v-model="ipRangeEnd" class="h-8 text-xs px-2" />
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
              已发现 {{ discoveredDevices.length }} 台设备
            </div>
          </div>

          <Button class="w-full" size="lg" @click="isScanning ? stopScan() : startScan()" :variant="isScanning ? 'destructive' : 'default'">
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
                <div v-for="(log, i) in scanLogs" :key="i" class="opacity-80 break-all mb-1">
                  {{ log }}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Middle Results Grid -->
      <Card class="flex flex-col h-full bg-muted/20 border-l-0 border-r-0 rounded-none shadow-none">
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <CardTitle>扫描结果</CardTitle>
            <div class="flex gap-2" v-if="selectedDevices.size > 0">
              <Button size="sm" @click="handleAddSelected">
                <Plus class="w-4 h-4 mr-2" />
                添加选中 ({{ selectedDevices.size }})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent class="flex-1 overflow-auto p-4">
          <div v-if="discoveredDevices.length === 0" class="h-full flex flex-col items-center justify-center text-muted-foreground/50">
            <Monitor class="w-16 h-16 mb-4 opacity-20" />
            <p>暂无发现设备</p>
          </div>
          
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <div 
              v-for="device in discoveredDevices" 
              :key="device.ip"
              class="group relative bg-card border rounded-lg p-4 transition-all hover:shadow-md cursor-pointer"
              :class="[
                {'ring-2 ring-primary': selectedDevices.has(device.ip), 'opacity-60 grayscale': isExisting(device)},
                selectedDevice?.ip === device.ip ? 'border-primary ring-1 ring-primary' : ''
              ]"
              @click="selectDevice(device)"
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

              <!-- Selection Checkbox (Stop propagation to prevent opening detail) -->
              <div v-if="!isExisting(device)" class="absolute top-4 right-4" @click.stop="toggleSelection(device)">
                <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                  :class="selectedDevices.has(device.ip) ? 'bg-primary border-primary' : 'border-muted-foreground/30 bg-background'"
                >
                  <Check v-if="selectedDevices.has(device.ip)" class="w-3 h-3 text-primary-foreground" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Right Detail Panel -->
      <Card v-if="selectedDevice" class="flex flex-col h-full border-l shadow-lg animate-in slide-in-from-right-10 duration-300">
        <CardHeader class="pb-3 border-b bg-muted/10">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <Settings class="w-5 h-5 text-primary" />
                <CardTitle class="text-base">设备详情</CardTitle>
            </div>
            <Button variant="ghost" size="icon" class="h-8 w-8" @click="selectedDevice = null">
                <X class="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <ScrollArea class="flex-1">
            <div class="p-4 space-y-6">
                <!-- Info Section -->
                <div class="space-y-1">
                    <h3 class="font-medium text-lg leading-none">{{ selectedDevice.name }}</h3>
                    <p class="text-sm text-muted-foreground font-mono">{{ selectedDevice.manufacturer }}</p>
                    <div class="flex gap-2 mt-2">
                        <Badge variant="outline">{{ selectedDevice.ip }}</Badge>
                        <Badge variant="secondary">{{ selectedDevice.type }}</Badge>
                    </div>
                </div>

                <Separator />

                <!-- Login Section -->
                <div v-if="!isLoggedIn" class="space-y-4">
                    <div class="flex items-center gap-2 text-sm font-medium text-primary">
                        <Lock class="w-4 h-4" />
                        管理员登录
                    </div>
                    <div class="space-y-3">
                        <div class="space-y-1">
                            <label class="text-xs font-medium">用户名</label>
                            <Input v-model="loginForm.username" placeholder="admin" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-medium">密码</label>
                            <Input v-model="loginForm.password" type="password" placeholder="••••••" />
                        </div>
                        <Button class="w-full" @click="handleLogin" :disabled="isLoggingIn">
                            <Loader2 v-if="isLoggingIn" class="w-4 h-4 mr-2 animate-spin" />
                            登录并获取配置
                        </Button>
                    </div>
                </div>

                <!-- Network Config Section -->
                <div v-else class="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-sm font-medium text-primary">
                            <Network class="w-4 h-4" />
                            网络配置
                        </div>
                        <Button variant="ghost" size="icon" class="h-6 w-6" @click="handleRefreshNetwork" :disabled="networkLoading">
                            <RefreshCw class="w-3 h-3" :class="{'animate-spin': networkLoading}" />
                        </Button>
                    </div>

                    <div class="space-y-4 p-4 border rounded-lg bg-card/50">
                        <div class="flex items-center justify-between">
                            <label class="text-sm font-medium">启用 DHCP</label>
                            <Switch v-model:checked="networkConfig.dhcp" />
                        </div>
                        
                        <div class="space-y-3">
                            <div class="space-y-1">
                                <label class="text-xs font-medium">IP 地址</label>
                                <Input v-model="networkConfig.ip" :disabled="networkConfig.dhcp" class="font-mono" />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-medium">子网掩码</label>
                                <Input v-model="networkConfig.subnet" :disabled="networkConfig.dhcp" class="font-mono" />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-medium">默认网关</label>
                                <Input v-model="networkConfig.gateway" :disabled="networkConfig.dhcp" class="font-mono" />
                            </div>
                        </div>

                        <Button class="w-full" @click="handleSaveNetwork" :disabled="networkLoading">
                            <Save v-if="!networkLoading" class="w-4 h-4 mr-2" />
                            <Loader2 v-else class="w-4 h-4 mr-2 animate-spin" />
                            保存配置
                        </Button>
                    </div>
                    
                    <Button variant="outline" class="w-full text-muted-foreground" size="sm" @click="isLoggedIn = false">
                        退出登录
                    </Button>
                </div>
            </div>
        </ScrollArea>
      </Card>
    </div>
  </div>
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
