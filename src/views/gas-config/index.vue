<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useDeviceStore } from '@/stores/device'
import { getGasConfig, setGasConfig } from '@/api/gas'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Select } from '@/components/ui'

const store = useDeviceStore()

// 日志
interface LogEntry {
  id: number
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
  time: string
  data?: any
}
const logs = ref<LogEntry[]>([
  { id: 0, type: 'info', message: '欢迎使用IPC气体配置管理', time: new Date().toLocaleTimeString() }
])
const logContainer = ref<HTMLElement>()

const addLog = (type: LogEntry['type'], message: string, data?: any) => {
  logs.value.push({
    id: Date.now(),
    type,
    message,
    time: new Date().toLocaleTimeString(),
    data
  })
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

const clearLogs = () => {
  logs.value = [{ id: Date.now(), type: 'info', message: '日志已清空', time: new Date().toLocaleTimeString() }]
}

// 添加设备
const newDevice = ref({ name: '', ip: '', authId: '' })
const handleAddDevice = () => {
  if (!newDevice.value.name || !newDevice.value.ip || !newDevice.value.authId) {
    addLog('error', '请填写完整的设备信息')
    return
  }
  try {
    store.addDevice(newDevice.value)
    addLog('success', `设备 "${newDevice.value.name}" 添加成功`)
    newDevice.value = { name: '', ip: '', authId: '' }
  } catch (e: any) {
    addLog('error', e.message)
  }
}

// 删除设备
const handleRemoveDevice = (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (device && confirm(`确定删除设备 "${device.name}"？`)) {
    store.removeDevice(id)
    addLog('warning', `设备 "${device.name}" 已删除`)
  }
}

// 清空设备
const handleClearDevices = () => {
  if (store.devices.length === 0) {
    addLog('warning', '设备列表为空')
    return
  }
  if (confirm('确定清空所有设备？')) {
    store.clearDevices()
    addLog('warning', '已清空所有设备')
  }
}

// 获取单个设备配置
const isLoading = ref(false)
const handleGetConfig = async (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (!device) return

  addLog('info', `正在获取设备 "${device.name}" (${device.ip}) 的配置...`)

  try {
    const data = await getGasConfig(device.ip, store.globalConfig)
    store.updateDeviceStatus(id, 'online')
    addLog('success', `设备 "${device.name}" 配置获取成功`, data)
  } catch (e: any) {
    store.updateDeviceStatus(id, 'offline')
    addLog('error', `设备 "${device.name}" 获取失败: ${e.message}`)
  }
}

// 设置单个设备配置
const handleSetConfig = async (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (!device) return

  addLog('info', `正在设置设备 "${device.name}" (${device.ip}) 的配置...`)

  try {
    const data = await setGasConfig(device.ip, device.authId, store.globalConfig)
    store.updateDeviceStatus(id, 'online')
    addLog('success', `设备 "${device.name}" 配置设置成功`, data)
  } catch (e: any) {
    store.updateDeviceStatus(id, 'offline')
    addLog('error', `设备 "${device.name}" 设置失败: ${e.message}`)
  }
}

// 批量获取
const handleBatchGet = async () => {
  if (store.devices.length === 0) {
    addLog('warning', '设备列表为空')
    return
  }

  isLoading.value = true
  addLog('info', `开始批量获取 ${store.devices.length} 台设备的配置...`)

  let success = 0, fail = 0
  for (const device of store.devices) {
    try {
      const data = await getGasConfig(device.ip, store.globalConfig)
      store.updateDeviceStatus(device.id, 'online')
      addLog('success', `[${device.name}] 获取成功`, data)
      success++
    } catch (e: any) {
      store.updateDeviceStatus(device.id, 'offline')
      addLog('error', `[${device.name}] 获取失败: ${e.message}`)
      fail++
    }
  }

  isLoading.value = false
  addLog('info', `批量获取完成: 成功 ${success} 台, 失败 ${fail} 台`)
}

// 批量设置
const handleBatchSet = async () => {
  if (store.devices.length === 0) {
    addLog('warning', '设备列表为空')
    return
  }

  if (!confirm(`确定将配置应用到所有 ${store.devices.length} 台设备？`)) return

  isLoading.value = true
  addLog('info', `开始批量设置 ${store.devices.length} 台设备的配置...`)

  let success = 0, fail = 0
  for (const device of store.devices) {
    try {
      const data = await setGasConfig(device.ip, device.authId, store.globalConfig)
      store.updateDeviceStatus(device.id, 'online')
      addLog('success', `[${device.name}] 设置成功`, data)
      success++
    } catch (e: any) {
      store.updateDeviceStatus(device.id, 'offline')
      addLog('error', `[${device.name}] 设置失败: ${e.message}`)
      fail++
    }
  }

  isLoading.value = false
  addLog('info', `批量设置完成: 成功 ${success} 台, 失败 ${fail} 台`)
}

// 导入导出
const fileInput = ref<HTMLInputElement>()
const handleExport = () => {
  if (store.devices.length === 0) {
    addLog('warning', '没有设备可导出')
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
  addLog('success', `已导出 ${store.devices.length} 个设备`)
}

const handleImport = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const count = store.importDevices(ev.target?.result as string)
      addLog('success', `成功导入 ${count} 个设备`)
    } catch (err: any) {
      addLog('error', `导入失败: ${err.message}`)
    }
  }
  reader.readAsText(file)
  if (fileInput.value) fileInput.value.value = ''
}

// 状态映射
const statusConfig = {
  online: { text: '在线', variant: 'success' as const },
  offline: { text: '离线', variant: 'destructive' as const },
  unknown: { text: '未知', variant: 'secondary' as const }
}

// 日志类型图标和样式
const logConfig = {
  info: { icon: 'i-lucide-info', colorClass: 'text-[hsl(var(--primary))]', bgClass: 'bg-[hsl(var(--primary)/0.1)]' },
  success: { icon: 'i-lucide-check-circle', colorClass: 'text-[hsl(var(--success))]', bgClass: 'bg-[hsl(var(--success)/0.1)]' },
  error: { icon: 'i-lucide-x-circle', colorClass: 'text-[hsl(var(--destructive))]', bgClass: 'bg-[hsl(var(--destructive)/0.1)]' },
  warning: { icon: 'i-lucide-alert-triangle', colorClass: 'text-[hsl(var(--warning))]', bgClass: 'bg-[hsl(var(--warning)/0.1)]' }
}
</script>

<template>
  <div class="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-4 h-full">
    <!-- 左侧：配置和设备管理 -->
    <div class="space-y-4 overflow-auto">
      <!-- 全局配置 -->
      <Card>
        <CardHeader class="pb-3">
          <CardTitle class="flex items-center gap-2">
            <span class="i-lucide-settings h-4 w-4 text-[hsl(var(--primary))]" />
            全局配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-[hsl(var(--muted-foreground))]">设备账号</label>
              <Input
                v-model="store.globalConfig.username"
                @change="store.saveToStorage()"
                placeholder="admin"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-[hsl(var(--muted-foreground))]">设备密码</label>
              <Input
                v-model="store.globalConfig.password"
                @change="store.saveToStorage()"
                type="password"
                placeholder="password"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-[hsl(var(--muted-foreground))]">Client ID</label>
              <Input
                v-model="store.globalConfig.clientId"
                @change="store.saveToStorage()"
              />
            </div>
          </div>
          <div class="grid grid-cols-[1fr_120px_100px] gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-[hsl(var(--muted-foreground))]">上传地址 (UploadPath)</label>
              <Input
                v-model="store.globalConfig.uploadPath"
                @change="store.saveToStorage()"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-[hsl(var(--muted-foreground))]">波特率</label>
              <Select v-model="store.globalConfig.baudRate" @change="store.saveToStorage()">
                <option :value="9600">9600</option>
                <option :value="19200">19200</option>
                <option :value="38400">38400</option>
                <option :value="57600">57600</option>
                <option :value="115200">115200</option>
              </Select>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-[hsl(var(--muted-foreground))]">启用</label>
              <Select v-model="store.globalConfig.enable" @change="store.saveToStorage()">
                <option :value="1">启用</option>
                <option :value="0">禁用</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 设备管理 -->
      <Card class="flex flex-col">
        <CardHeader class="pb-3">
          <CardTitle class="flex items-center gap-2">
            <span class="i-lucide-monitor h-4 w-4 text-[hsl(var(--primary))]" />
            设备管理
            <Badge variant="secondary" class="ml-2">{{ store.devices.length }}</Badge>
          </CardTitle>
          <div class="flex gap-2">
            <Button variant="ghost" size="sm" @click="handleExport">
              <span class="i-lucide-download h-3.5 w-3.5" />
              导出
            </Button>
            <Button variant="ghost" size="sm" @click="fileInput?.click()">
              <span class="i-lucide-upload h-3.5 w-3.5" />
              导入
            </Button>
            <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport" />
          </div>
        </CardHeader>
        <CardContent class="flex-1 flex flex-col">
          <!-- 添加设备 -->
          <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-3 p-3 rounded-lg bg-[hsl(var(--muted))]">
            <Input v-model="newDevice.name" placeholder="设备名称" />
            <Input v-model="newDevice.ip" placeholder="设备IP" />
            <Input v-model="newDevice.authId" placeholder="AuthID" />
            <Button @click="handleAddDevice" size="sm">
              <span class="i-lucide-plus h-4 w-4" />
              添加
            </Button>
          </div>

          <!-- 设备列表 -->
          <div class="flex-1 space-y-2 overflow-y-auto max-h-[280px] pr-1">
            <div v-if="store.devices.length === 0" class="flex flex-col items-center justify-center py-8 text-[hsl(var(--muted-foreground))]">
              <span class="i-lucide-inbox h-10 w-10 mb-2 opacity-50" />
              <span class="text-sm">暂无设备，请添加</span>
            </div>
            <div
              v-for="device in store.devices"
              :key="device.id"
              class="grid grid-cols-[1fr_1fr_80px_auto] gap-3 items-center p-3 rounded-lg bg-[hsl(var(--muted)/0.5)] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <div class="min-w-0">
                <div class="font-medium text-sm truncate">{{ device.name }}</div>
                <div class="text-xs text-[hsl(var(--muted-foreground))] truncate">{{ device.ip }}</div>
              </div>
              <div class="text-sm text-[hsl(var(--muted-foreground))] truncate">{{ device.authId }}</div>
              <div>
                <Badge :variant="statusConfig[device.status].variant">
                  {{ statusConfig[device.status].text }}
                </Badge>
              </div>
              <div class="flex gap-1">
                <Button variant="ghost" size="sm" @click="handleGetConfig(device.id)" :disabled="isLoading" class="h-7 px-2">
                  <span class="i-lucide-download h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" @click="handleSetConfig(device.id)" :disabled="isLoading" class="h-7 px-2">
                  <span class="i-lucide-upload h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" @click="handleRemoveDevice(device.id)" :disabled="isLoading" class="h-7 px-2 text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]">
                  <span class="i-lucide-trash-2 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <!-- 批量操作 -->
          <div class="flex gap-2 mt-3 pt-3 border-t border-[hsl(var(--border))]">
            <Button @click="handleBatchGet" :disabled="isLoading" class="flex-1" :loading="isLoading">
              <span class="i-lucide-download h-4 w-4" />
              批量获取
            </Button>
            <Button variant="success" @click="handleBatchSet" :disabled="isLoading" class="flex-1" :loading="isLoading">
              <span class="i-lucide-upload h-4 w-4" />
              批量设置
            </Button>
            <Button variant="destructive" @click="handleClearDevices" :disabled="isLoading" size="icon">
              <span class="i-lucide-trash h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 右侧：运行日志 -->
    <Card class="flex flex-col h-[calc(100vh-140px)]">
      <CardHeader class="pb-3">
        <CardTitle class="flex items-center gap-2">
          <span class="i-lucide-terminal h-4 w-4 text-[hsl(var(--primary))]" />
          运行日志
        </CardTitle>
        <Button variant="ghost" size="sm" @click="clearLogs" class="text-[hsl(var(--destructive))]">
          <span class="i-lucide-trash-2 h-3.5 w-3.5" />
          清空
        </Button>
      </CardHeader>
      <CardContent class="flex-1 overflow-hidden pt-0">
        <div 
          ref="logContainer"
          class="h-full overflow-y-auto rounded-lg p-3 space-y-2 log-panel"
        >
          <div
            v-for="log in logs"
            :key="log.id"
            :class="['p-2.5 rounded-md text-sm', logConfig[log.type].bgClass]"
          >
            <div class="flex items-start gap-2">
              <span :class="[logConfig[log.type].icon, logConfig[log.type].colorClass, 'h-4 w-4 mt-0.5 flex-shrink-0']" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-[hsl(var(--muted-foreground))]">{{ log.time }}</span>
                </div>
                <span :class="logConfig[log.type].colorClass">{{ log.message }}</span>
                <pre v-if="log.data" class="mt-2 text-xs bg-[hsl(var(--background))] p-2 rounded overflow-x-auto text-[hsl(var(--muted-foreground))]">{{ JSON.stringify(log.data, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
