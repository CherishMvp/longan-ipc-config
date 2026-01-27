<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useDeviceStore } from '@/stores/device'
import { getGasConfig, setGasConfig } from '@/api/gas'

const store = useDeviceStore()

// Log system
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

// Device management
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

const handleRemoveDevice = (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (device && confirm(`确定删除设备 "${device.name}"？`)) {
    store.removeDevice(id)
    addLog('warning', `设备 "${device.name}" 已删除`)
  }
}

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

// API operations
const isLoading = ref(false)

const handleGetConfig = async (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (!device) return

  addLog('info', `正在获取 "${device.name}" (${device.ip}) 的配置...`)

  try {
    const data = await getGasConfig(device.ip, store.globalConfig)
    store.updateDeviceStatus(id, 'online')
    addLog('success', `"${device.name}" 配置获取成功`, data)
  } catch (e: any) {
    store.updateDeviceStatus(id, 'offline')
    addLog('error', `"${device.name}" 获取失败: ${e.message}`)
  }
}

const handleSetConfig = async (id: number) => {
  const device = store.devices.find(d => d.id === id)
  if (!device) return

  addLog('info', `正在设置 "${device.name}" (${device.ip}) 的配置...`)

  try {
    const data = await setGasConfig(device.ip, device.authId, store.globalConfig)
    store.updateDeviceStatus(id, 'online')
    addLog('success', `"${device.name}" 配置设置成功`, data)
  } catch (e: any) {
    store.updateDeviceStatus(id, 'offline')
    addLog('error', `"${device.name}" 设置失败: ${e.message}`)
  }
}

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

// Import/Export
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

// Status badge config
const statusConfig = {
  online: { text: '在线', class: 'badge-success' },
  offline: { text: '离线', class: 'badge-destructive' },
  unknown: { text: '未知', class: 'badge-secondary' }
}

// Log type config
const logConfig = {
  info: { icon: 'i-lucide-info', class: 'text-info' },
  success: { icon: 'i-lucide-check-circle-2', class: 'text-success' },
  error: { icon: 'i-lucide-x-circle', class: 'text-destructive' },
  warning: { icon: 'i-lucide-alert-triangle', class: 'text-warning' }
}
</script>

<template>
  <div class="dark grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 h-full">
    <!-- Left: Config & Device Management -->
    <div class="space-y-4 overflow-auto">
      
      <!-- Global Config Card -->
      <div class="card">
        <div class="card-header flex-row items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="i-lucide-settings h-4 w-4 text-muted-foreground" />
            <h3 class="card-title">全局配置</h3>
          </div>
        </div>
        <div class="card-content">
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">设备账号</label>
              <input
                v-model="store.globalConfig.username"
                @change="store.saveToStorage()"
                class="input-base"
                placeholder="admin"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">设备密码</label>
              <input
                v-model="store.globalConfig.password"
                @change="store.saveToStorage()"
                type="password"
                class="input-base"
                placeholder="password"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">Client ID</label>
              <input
                v-model="store.globalConfig.clientId"
                @change="store.saveToStorage()"
                class="input-base"
              />
            </div>
          </div>
          <div class="grid grid-cols-[1fr_100px_80px] gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">上传地址 (UploadPath)</label>
              <input
                v-model="store.globalConfig.uploadPath"
                @change="store.saveToStorage()"
                class="input-base"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">波特率</label>
              <select v-model.number="store.globalConfig.baudRate" @change="store.saveToStorage()" class="input-base">
                <option :value="9600">9600</option>
                <option :value="19200">19200</option>
                <option :value="38400">38400</option>
                <option :value="57600">57600</option>
                <option :value="115200">115200</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">启用</label>
              <select v-model.number="store.globalConfig.enable" @change="store.saveToStorage()" class="input-base">
                <option :value="1">启用</option>
                <option :value="0">禁用</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Device Management Card -->
      <div class="card flex flex-col">
        <div class="card-header flex-row items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="i-lucide-monitor h-4 w-4 text-muted-foreground" />
            <h3 class="card-title">设备管理</h3>
            <span class="badge badge-secondary text-[10px] ml-1">{{ store.devices.length }}</span>
          </div>
          <div class="flex gap-1">
            <button @click="handleExport" class="btn btn-ghost btn-sm">
              <span class="i-lucide-download h-3.5 w-3.5" />
              导出
            </button>
            <button @click="fileInput?.click()" class="btn btn-ghost btn-sm">
              <span class="i-lucide-upload h-3.5 w-3.5" />
              导入
            </button>
            <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport" />
          </div>
        </div>
        <div class="card-content flex-1 flex flex-col">
          <!-- Add Device Form -->
          <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-3 p-2.5 rounded-md bg-muted/50">
            <input v-model="newDevice.name" class="input-base" placeholder="设备名称" />
            <input v-model="newDevice.ip" class="input-base" placeholder="设备IP" />
            <input v-model="newDevice.authId" class="input-base" placeholder="AuthID" />
            <button @click="handleAddDevice" class="btn btn-default btn-sm">
              <span class="i-lucide-plus h-4 w-4" />
              添加
            </button>
          </div>

          <!-- Device List -->
          <div class="flex-1 space-y-1.5 overflow-y-auto max-h-[260px] pr-1">
            <div v-if="store.devices.length === 0" class="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <span class="i-lucide-inbox h-8 w-8 mb-2 opacity-40" />
              <span class="text-xs">暂无设备，请添加</span>
            </div>
            <div
              v-for="device in store.devices"
              :key="device.id"
              class="grid grid-cols-[1fr_1fr_70px_auto] gap-2 items-center p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div class="min-w-0">
                <div class="text-sm font-medium truncate">{{ device.name }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ device.ip }}</div>
              </div>
              <div class="text-xs text-muted-foreground truncate">{{ device.authId }}</div>
              <div>
                <span :class="['badge', statusConfig[device.status].class]">
                  {{ statusConfig[device.status].text }}
                </span>
              </div>
              <div class="flex gap-0.5">
                <button @click="handleGetConfig(device.id)" :disabled="isLoading" class="btn btn-ghost btn-icon btn-sm" title="获取配置">
                  <span class="i-lucide-download h-3.5 w-3.5" />
                </button>
                <button @click="handleSetConfig(device.id)" :disabled="isLoading" class="btn btn-ghost btn-icon btn-sm" title="设置配置">
                  <span class="i-lucide-upload h-3.5 w-3.5" />
                </button>
                <button @click="handleRemoveDevice(device.id)" :disabled="isLoading" class="btn btn-ghost btn-icon btn-sm text-destructive" title="删除">
                  <span class="i-lucide-trash-2 h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Batch Actions -->
          <div class="flex gap-2 mt-3 pt-3 border-t border-border">
            <button @click="handleBatchGet" :disabled="isLoading" class="btn btn-secondary flex-1">
              <span v-if="isLoading" class="i-lucide-loader-2 h-4 w-4 animate-spin" />
              <span v-else class="i-lucide-download h-4 w-4" />
              批量获取
            </button>
            <button @click="handleBatchSet" :disabled="isLoading" class="btn btn-success flex-1">
              <span v-if="isLoading" class="i-lucide-loader-2 h-4 w-4 animate-spin" />
              <span v-else class="i-lucide-upload h-4 w-4" />
              批量设置
            </button>
            <button @click="handleClearDevices" :disabled="isLoading" class="btn btn-outline btn-icon" title="清空设备">
              <span class="i-lucide-trash h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: Log Panel -->
    <div class="card flex flex-col h-[calc(100vh-140px)]">
      <div class="card-header flex-row items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="i-lucide-terminal h-4 w-4 text-muted-foreground" />
          <h3 class="card-title">运行日志</h3>
        </div>
        <button @click="clearLogs" class="btn btn-ghost btn-sm text-destructive">
          <span class="i-lucide-trash-2 h-3.5 w-3.5" />
          清空
        </button>
      </div>
      <div class="card-content flex-1 overflow-hidden">
        <div 
          ref="logContainer"
          class="h-full overflow-y-auto rounded-md p-2 space-y-1 log-panel"
        >
          <div
            v-for="log in logs"
            :key="log.id"
            class="flex items-start gap-2 p-2 rounded text-xs"
          >
            <span :class="[logConfig[log.type].icon, logConfig[log.type].class, 'h-3.5 w-3.5 mt-0.5 flex-shrink-0']" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-muted-foreground">{{ log.time }}</span>
              </div>
              <span :class="logConfig[log.type].class">{{ log.message }}</span>
              <pre v-if="log.data" class="mt-1.5 text-[10px] bg-background/50 p-1.5 rounded overflow-x-auto text-muted-foreground">{{ JSON.stringify(log.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-muted-foreground { color: hsl(var(--muted-foreground)); }
.text-destructive { color: hsl(var(--destructive)); }
.text-success { color: hsl(var(--success)); }
.text-warning { color: hsl(var(--warning)); }
.text-info { color: hsl(var(--info)); }
.bg-muted\/50 { background-color: hsl(var(--muted) / 0.5); }
.bg-muted\/30 { background-color: hsl(var(--muted) / 0.3); }
.hover\:bg-muted\/50:hover { background-color: hsl(var(--muted) / 0.5); }
.bg-background\/50 { background-color: hsl(var(--background) / 0.5); }
.border-border { border-color: hsl(var(--border)); }

.badge-success {
  background-color: hsl(var(--success) / 0.15);
  color: hsl(var(--success));
}

.badge-destructive {
  background-color: hsl(var(--destructive) / 0.15);
  color: hsl(var(--destructive));
}
</style>
