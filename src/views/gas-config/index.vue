<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useDeviceStore } from '@/stores/device'
import { getGasConfig, setGasConfig } from '@/api/gas'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Settings, 
  Monitor, 
  Trash2, 
  Plus, 
  Terminal, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RotateCw,
  RefreshCw,
  Save,
  FileDown,
  FileUp
} from 'lucide-vue-next'

const store = useDeviceStore()
const logContainer = ref<HTMLElement>()

// Loading states
const isSyncing = ref(false)
const isPushing = ref(false)
// Generic loading for other ops (clear, import/export)
const isGlobalLoading = ref(false)

// Auto-scroll logs
watch(() => store.logs.length, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
})

// Device management
const newDevice = ref({ name: '', ip: '', authId: '' })

// IP Validation Regex (IPv4)
const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
// AuthID Validation (Numeric only)
const authIdRegex = /^\d+$/

const validateDevice = (device: { name: string, ip: string, authId: string }) => {
  if (!device.name.trim()) return '设备名称不能为空'
  if (!device.ip.trim()) return '设备IP不能为空'
  if (!ipRegex.test(device.ip)) return 'IP地址格式不正确 (例如 192.168.1.100)'
  if (!device.authId.trim()) return 'AuthID不能为空'
  if (!authIdRegex.test(device.authId)) return 'AuthID必须为纯数字'
  return null
}

const handleAddDevice = () => {
  const error = validateDevice(newDevice.value)
  if (error) {
    store.addLog('error', error)
    return
  }

  try {
    store.addDevice(newDevice.value)
    store.addLog('success', `设备 "${newDevice.value.name}" 添加成功`)
    newDevice.value = { name: '', ip: '', authId: '' }
  } catch (e: any) {
    store.addLog('error', e.message)
  }
}

const handleRemoveDevice = (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (device && confirm(`确定删除设备 "${device.name}"？`)) {
    store.removeDevice(id)
    store.addLog('warning', `设备 "${device.name}" 已删除`)
  }
}

const handleClearDevices = () => {
  if (store.devices.length === 0) {
    store.addLog('warning', '设备列表为空')
    return
  }
  if (confirm('确定清空所有设备？')) {
    store.clearDevices()
    store.addLog('warning', '已清空所有设备')
  }
}

// API operations
// Single operations map to track loading per device (optional enhancement)
const deviceLoading = ref<Record<number, boolean>>({})

const handleGetConfig = async (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (!device) return

  deviceLoading.value[id] = true
  store.addLog('info', `正在同步 "${device.name}" (${device.ip}) 的配置...`)

  try {
    const data = await getGasConfig(device.ip, store.globalConfig)
    store.updateDeviceStatus(id, 'online')
    store.addLog('success', `"${device.name}" 配置同步成功`, data)
  } catch (e: any) {
    store.updateDeviceStatus(id, 'offline')
    store.addLog('error', `"${device.name}" 同步失败: ${e.message}`)
  } finally {
    deviceLoading.value[id] = false
  }
}

const handleSetConfig = async (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (!device) return

  deviceLoading.value[id] = true
  store.addLog('info', `正在下发配置到 "${device.name}" (${device.ip})...`)

  try {
    const data = await setGasConfig(device.ip, device.authId, store.globalConfig)
    store.updateDeviceStatus(id, 'online')
    store.addLog('success', `"${device.name}" 配置下发成功`, data)
  } catch (e: any) {
    store.updateDeviceStatus(id, 'offline')
    store.addLog('error', `"${device.name}" 下发失败: ${e.message}`)
  } finally {
    deviceLoading.value[id] = false
  }
}

const handleBatchGet = async () => {
  if (store.devices.length === 0) {
    store.addLog('warning', '设备列表为空')
    return
  }

  isSyncing.value = true
  store.addLog('info', `开始批量同步 ${store.devices.length} 台设备的配置...`)

  let success = 0, fail = 0
  for (const device of store.devices) {
    try {
      const data = await getGasConfig(device.ip, store.globalConfig)
      store.updateDeviceStatus(device.id, 'online')
      store.addLog('success', `[${device.name}] 同步成功`, data)
      success++
    } catch (e: any) {
      store.updateDeviceStatus(device.id, 'offline')
      store.addLog('error', `[${device.name}] 同步失败: ${e.message}`)
      fail++
    }
  }

  isSyncing.value = false
  store.addLog('info', `批量同步完成: 成功 ${success} 台, 失败 ${fail} 台`)
}

const handleBatchSet = async () => {
  if (store.devices.length === 0) {
    store.addLog('warning', '设备列表为空')
    return
  }

  if (!confirm(`确定将配置应用到所有 ${store.devices.length} 台设备？`)) return

  isPushing.value = true
  store.addLog('info', `开始批量下发配置到 ${store.devices.length} 台设备...`)

  let success = 0, fail = 0
  for (const device of store.devices) {
    try {
      const data = await setGasConfig(device.ip, device.authId, store.globalConfig)
      store.updateDeviceStatus(device.id, 'online')
      store.addLog('success', `[${device.name}] 下发成功`, data)
      success++
    } catch (e: any) {
      store.updateDeviceStatus(device.id, 'offline')
      store.addLog('error', `[${device.name}] 下发失败: ${e.message}`)
      fail++
    }
  }

  isPushing.value = false
  store.addLog('info', `批量下发完成: 成功 ${success} 台, 失败 ${fail} 台`)
}

// Import/Export
const fileInput = ref<HTMLInputElement>()

const handleExport = () => {
  if (store.devices.length === 0) {
    store.addLog('warning', '没有设备可导出')
    return
  }
  const data = store.exportDevices()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ipc_devices.json'
  a.click()
  URL.revokeObjectURL(url)
  store.addLog('success', `已导出 ${store.devices.length} 个设备`)
}

const handleImport = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const count = store.importDevices(ev.target?.result as string)
      store.addLog('success', `成功导入 ${count} 个设备`)
    } catch (err: any) {
      store.addLog('error', `导入失败: ${err.message}`)
    }
  }
  reader.readAsText(file)
  if (fileInput.value) fileInput.value.value = ''
}

// Config helpers for status badge
const getStatusVariant = (status: string) => {
  switch (status) {
    case 'online': return 'default'
    case 'offline': return 'destructive'
    default: return 'secondary'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'online': return '在线'
    case 'offline': return '离线'
    default: return '未知'
  }
}

// Log type icons
const getLogIcon = (type: string) => {
  switch (type) {
    case 'info': return Info
    case 'success': return CheckCircle2
    case 'error': return XCircle
    case 'warning': return AlertTriangle
    default: return Info
  }
}

const getLogClass = (type: string) => {
  switch (type) {
    case 'info': return 'text-blue-500'
    case 'success': return 'text-green-500'
    case 'error': return 'text-red-500'
    case 'warning': return 'text-yellow-500'
    default: return 'text-muted-foreground'
  }
}
</script>

<template>
  <div class="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 h-full">
    <!-- Left Column: Config & Devices -->
    <div class="flex flex-col gap-6 overflow-hidden">
      
      <!-- Global Configuration -->
      <Card>
        <CardHeader class="pb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-primary/10 rounded-md text-primary">
              <Settings class="w-5 h-5" />
            </div>
            <div>
              <CardTitle>全局配置</CardTitle>
              <CardDescription>设置连接 IPC 设备的通用参数</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none">账号 (Username)</label>
              <Input v-model="store.globalConfig.username" placeholder="admin" @change="store.saveToStorage()" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none">密码 (Password)</label>
              <Input v-model="store.globalConfig.password" type="password" placeholder="••••••" @change="store.saveToStorage()" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none">客户端 ID (Client ID)</label>
              <Input v-model="store.globalConfig.clientId" placeholder="输入 Client ID" @change="store.saveToStorage()" />
            </div>
            
            <div class="col-span-1 md:col-span-2 space-y-2">
              <label class="text-sm font-medium leading-none">上传地址 (Upload Path)</label>
              <Input v-model="store.globalConfig.uploadPath" placeholder="http://..." @change="store.saveToStorage()" />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-sm font-medium leading-none">波特率 (Baud Rate)</label>
                <Select v-model="store.globalConfig.baudRate" @update:model-value="store.saveToStorage()">
                  <SelectTrigger>
                    <SelectValue placeholder="选择波特率" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="9600">9600</SelectItem>
                    <SelectItem :value="19200">19200</SelectItem>
                    <SelectItem :value="38400">38400</SelectItem>
                    <SelectItem :value="57600">57600</SelectItem>
                    <SelectItem :value="115200">115200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div class="space-y-2">
                <label class="text-sm font-medium leading-none">状态 (Status)</label>
                <Select v-model="store.globalConfig.enable" @update:model-value="store.saveToStorage()">
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="1">启用 (Enabled)</SelectItem>
                    <SelectItem :value="0">禁用 (Disabled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Device Management -->
      <Card class="flex-1 flex flex-col min-h-0">
        <CardHeader class="pb-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="p-2 bg-blue-500/10 rounded-md text-blue-500">
                <Monitor class="w-5 h-5" />
              </div>
              <div>
                <CardTitle>设备列表</CardTitle>
                <CardDescription>管理需要配置的 IPC 设备</CardDescription>
              </div>
              <Badge variant="secondary" class="ml-2">{{ store.devices.length }}</Badge>
            </div>
            
            <div class="flex gap-2">
              <Button variant="outline" size="sm" @click="handleExport" class="h-8">
                <FileDown class="w-3.5 h-3.5 mr-2" />
                导出
              </Button>
              <Button variant="outline" size="sm" @click="fileInput?.click()" class="h-8">
                <FileUp class="w-3.5 h-3.5 mr-2" />
                导入
              </Button>
              <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport" />
            </div>
          </div>
        </CardHeader>
        
        <CardContent class="flex-1 flex flex-col min-h-0 gap-4">
          <!-- Add Device Input Group -->
          <div class="flex flex-col md:flex-row gap-2 p-1">
            <Input v-model="newDevice.name" placeholder="设备名称" class="flex-1" />
            <Input v-model="newDevice.ip" placeholder="设备IP (192.168.x.x)" class="flex-1" />
            <Input v-model="newDevice.authId" placeholder="Auth ID (纯数字)" class="flex-1" />
            <Button @click="handleAddDevice">
              <Plus class="w-4 h-4 mr-2" />
              添加
            </Button>
          </div>

          <Separator />

          <!-- Device List -->
          <div class="flex-1 overflow-auto -mx-6 px-6">
            <div v-if="store.devices.length === 0" class="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Monitor class="w-10 h-10 mb-2 opacity-20" />
              <p class="text-sm">暂无设备，请添加或导入</p>
            </div>
            
            <div class="space-y-2 pb-2">
              <div 
                v-for="device in store.devices" 
                :key="device.id"
                class="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-background group-hover:text-primary transition-colors">
                    <Monitor class="w-4 h-4" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-medium truncate">{{ device.name }}</div>
                    <div class="text-xs text-muted-foreground font-mono">{{ device.ip }} <span class="mx-1">·</span> {{ device.authId }}</div>
                  </div>
                </div>
                
                <div class="flex items-center gap-3">
                  <Badge :variant="getStatusVariant(device.status)" class="capitalize">
                    {{ getStatusLabel(device.status) }}
                  </Badge>
                  
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-8 w-8" 
                      @click="handleGetConfig(device.id)" 
                      :disabled="isSyncing || isPushing || deviceLoading[device.id]" 
                      title="同步配置"
                    >
                      <RotateCw :class="['w-4 h-4', deviceLoading[device.id] ? 'animate-spin' : '']" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-8 w-8" 
                      @click="handleSetConfig(device.id)" 
                      :disabled="isSyncing || isPushing || deviceLoading[device.id]" 
                      title="下发配置"
                    >
                      <Save class="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-8 w-8 text-destructive hover:text-destructive" 
                      @click="handleRemoveDevice(device.id)" 
                      :disabled="isSyncing || isPushing"
                    >
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Batch Actions Footer -->
          <div class="mt-auto pt-4 border-t flex gap-3">
            <Button variant="secondary" class="flex-1" @click="handleBatchGet" :disabled="isSyncing || isPushing">
              <RefreshCw :class="['w-4 h-4 mr-2', isSyncing ? 'animate-spin' : '']" />
              批量同步
            </Button>
            <Button class="flex-1" @click="handleBatchSet" :disabled="isSyncing || isPushing">
              <Save :class="['w-4 h-4 mr-2', isPushing ? 'animate-spin' : '']" />
              批量下发
            </Button>
            <Button variant="destructive" size="icon" @click="handleClearDevices" :disabled="isSyncing || isPushing">
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Right Column: Logs -->
    <Card class="flex flex-col h-full overflow-hidden border-l shadow-none rounded-none md:rounded-lg">
      <CardHeader class="pb-3 border-b bg-muted/20">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Terminal class="w-4 h-4 text-muted-foreground" />
            <CardTitle class="text-base">运行日志</CardTitle>
          </div>
          <Button variant="ghost" size="xs" class="h-7 text-xs text-muted-foreground hover:text-destructive" @click="store.clearLogs">
            清空
          </Button>
        </div>
      </CardHeader>
      <CardContent class="flex-1 p-0 overflow-hidden relative bg-black/95">
        <div 
          ref="logContainer"
          class="absolute inset-0 overflow-y-auto p-4 space-y-3 font-mono text-xs"
        >
          <div 
            v-for="log in store.logs" 
            :key="log.id"
            class="flex gap-3 group"
          >
            <div class="shrink-0 mt-0.5 opacity-70">
              <component :is="getLogIcon(log.type)" :class="['w-3.5 h-3.5', getLogClass(log.type)]" />
            </div>
            <div class="flex-1 min-w-0 break-words">
              <div class="flex items-center gap-2 mb-0.5">
                <span :class="['font-semibold', getLogClass(log.type)]">{{ log.type.toUpperCase() }}</span>
                <span class="text-zinc-500 text-[10px]">{{ log.time }}</span>
              </div>
              <p class="text-zinc-300 leading-relaxed">{{ log.message }}</p>
              <div v-if="log.data" class="mt-2 p-2 rounded bg-zinc-900 border border-zinc-800 overflow-x-auto">
                <pre class="text-zinc-400">{{ JSON.stringify(log.data, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
