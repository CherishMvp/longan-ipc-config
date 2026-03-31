<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Card,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  Settings, X, Lock, Loader2, Info, Network, Wrench, ExternalLink, Power, Clock, Save, RefreshCw
} from 'lucide-vue-next'
import type { DiscoveredDevice } from '@/types/electron'
import LivePlayer from './LivePlayer.vue'

const props = defineProps<{
  device: DiscoveredDevice | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'log', msg: string): void
}>()

// State
type TabType = 'info' | 'network' | 'maintenance'
const activeTab = ref<TabType>('info')
const isLoggedIn = ref(false)
const isLoggingIn = ref(false)
const loginForm = ref({ username: 'admin', password: '' })

// Data
const deviceInfo = ref<any>(null)
const protocols = ref<{ http: number; rtsp: number } | null>(null)
const networkConfig = ref({ token: '', dhcp: false, ip: '', subnet: '', gateway: '' })
const networkLoading = ref(false)
const deviceTime = ref('')
const passwordForm = ref({ newPassword: '', confirmPassword: '' })

// Player State
const streamUrl = ref('')
const snapshotUrl = ref('')
const isSnapshotLoading = ref(false)
const isLive = ref(false)
const liveInterval = ref<any>(null)

// Reset state when device changes
watch(() => props.device, () => {
  isLoggedIn.value = false
  activeTab.value = 'info'
  loginForm.value = { username: 'admin', password: '' }
  deviceInfo.value = null
  protocols.value = null
  networkConfig.value = { token: '', dhcp: false, ip: '', subnet: '', gateway: '' }
  deviceTime.value = ''
  snapshotUrl.value = ''
  streamUrl.value = ''
  isLive.value = false
  if (liveInterval.value) {
    clearInterval(liveInterval.value)
    liveInterval.value = null
  }
})

// --- API Actions ---

const handleLogin = async () => {
  if (!props.device) return
  isLoggingIn.value = true
  
  try {
    const url = props.device.xaddrs || `http://${props.device.ip}/onvif/device_service`
    const creds = {
        url,
        username: loginForm.value.username,
        password: loginForm.value.password
    }
    
    // Parallel fetch
    const [netRes, infoRes, protoRes, timeRes] = await Promise.all([
      window.electronAPI.getNetworkSettings(creds),
      window.electronAPI.getDeviceInformation(creds),
      window.electronAPI.getNetworkProtocols(creds),
      window.electronAPI.getTime(creds)
    ])
    
    if (netRes.success && netRes.config) {
      isLoggedIn.value = true
      networkConfig.value = { token: netRes.token || '', ...netRes.config }
      
      if (infoRes.success && infoRes.info) deviceInfo.value = infoRes.info
      if (protoRes.success && protoRes.protocols) protocols.value = protoRes.protocols
      if (timeRes.success && timeRes.displayTime) deviceTime.value = timeRes.displayTime
      
      emit('log', `登录成功: ${props.device.ip}`)
      activeTab.value = 'network' 
    } else {
      emit('log', `登录失败: ${netRes.error || '未知错误'}`)
    }
  } catch (e: any) {
    emit('log', `登录错误: ${e.message}`)
  } finally {
    isLoggingIn.value = false
  }
}

const handleRefreshNetwork = () => handleLogin()

const handleSaveNetwork = async () => {
  if (!props.device) return
  networkLoading.value = true
  try {
    const url = props.device.xaddrs || `http://${props.device.ip}/onvif/device_service`
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
    if (res.success) emit('log', `网络配置下发成功`)
    else emit('log', `配置失败: ${res.error}`)
  } catch (e: any) {
    emit('log', `配置错误: ${e.message}`)
  } finally {
    networkLoading.value = false
  }
}

const handleReboot = async () => {
  if (!confirm('确定要重启该设备吗？')) return
  try {
    const url = props.device?.xaddrs || `http://${props.device?.ip}/onvif/device_service`
    const res = await window.electronAPI.reboot({
      url,
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    if (res.success) emit('log', `设备正在重启: ${res.message}`)
    else emit('log', `重启失败: ${res.error}`)
  } catch (e: any) {
    emit('log', `重启错误: ${e.message}`)
  }
}

const handleSyncTime = async () => {
  if (!confirm('确定同步时间吗？')) return
  try {
    const url = props.device?.xaddrs || `http://${props.device?.ip}/onvif/device_service`
    const res = await window.electronAPI.setTime({
      url,
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    if (res.success) {
      emit('log', `时间同步成功`)
      const timeRes = await window.electronAPI.getTime({
        url,
        username: loginForm.value.username,
        password: loginForm.value.password
      })
      if (timeRes.success && timeRes.displayTime) deviceTime.value = timeRes.displayTime
    } else {
      emit('log', `同步失败: ${res.error}`)
    }
  } catch (e: any) {
    emit('log', `同步错误: ${e.message}`)
  }
}

const handleChangePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    emit('log', '错误: 两次密码不一致')
    return
  }
  if (!confirm('确定修改密码？')) return
  try {
    const url = props.device?.xaddrs || `http://${props.device?.ip}/onvif/device_service`
    const targetUser = loginForm.value.username || 'admin'
    const res = await window.electronAPI.setUser({
      url,
      targetUsername: targetUser,
      newPassword: passwordForm.value.newPassword,
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    if (res.success) {
      emit('log', `密码修改成功`)
      loginForm.value.password = passwordForm.value.newPassword
      passwordForm.value = { newPassword: '', confirmPassword: '' }
    } else {
      emit('log', `修改失败: ${res.error}`)
    }
  } catch (e: any) {
    emit('log', `修改错误: ${e.message}`)
  }
}

// --- Player Actions ---

const handleFetchSnapshot = async () => {
  if (!props.device) return
  isSnapshotLoading.value = true
  snapshotUrl.value = ''
  try {
    const url = props.device.xaddrs || `http://${props.device.ip}/onvif/device_service`
    const res = await window.electronAPI.getSnapshot({
      url,
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    if (res.success && res.dataUrl) snapshotUrl.value = res.dataUrl
    else emit('log', `获取快照失败: ${res.error}`)
  } catch (e: any) {
    emit('log', `快照错误: ${e.message}`)
  } finally {
    isSnapshotLoading.value = false
  }
}

const handleToggleLive = async () => {
  if (isLive.value) {
    isLive.value = false
    streamUrl.value = ''
    if (liveInterval.value) {
      clearInterval(liveInterval.value)
      liveInterval.value = null
    }
    return
  }

  if (!props.device) return
  isSnapshotLoading.value = true
  isLive.value = true
  
  try {
    const url = props.device.xaddrs || `http://${props.device.ip}/onvif/device_service`

    // HARDCODED URL FOR TESTING AS REQUESTED
    const hardcodedRtspUrl = 'rtsp://192.168.2.177:554/avstream/channel=1/stream=0-mainstream.sdp'
    
    // Automatic auth injection for hardcoded URL
    let rtspUrlWithAuth = hardcodedRtspUrl
    if (loginForm.value.username && loginForm.value.password && !hardcodedRtspUrl.includes('@')) {
        const parts = hardcodedRtspUrl.split('://')
        if (parts.length === 2) {
            rtspUrlWithAuth = `${parts[0]}://${loginForm.value.username}:${loginForm.value.password}@${parts[1]}`
        }
    }
    
    streamUrl.value = rtspUrlWithAuth
    emit('log', `启动 WebSocket-FLV 直出流 (测试地址): ${rtspUrlWithAuth}`)
    
  } catch (e: any) {
    emit('log', `直播失败: ${e.message}`)
    isLive.value = false
  } finally {
    isSnapshotLoading.value = false
  }
}

const openWebPage = () => {
  if (props.device?.ip) window.open(`http://${props.device.ip}`, '_blank')
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  emit('log', 'RTSP 地址已复制')
}
</script>

<template>
  <Card v-if="device" class="flex flex-col h-full border-l shadow-lg animate-in slide-in-from-right-10 duration-300">
    <CardHeader class="pb-3 border-b bg-muted/10 shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
            <Settings class="w-5 h-5 text-primary" />
            <CardTitle class="text-base">设备详情</CardTitle>
        </div>
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('close')">
            <X class="w-4 h-4" />
        </Button>
      </div>
    </CardHeader>
    
    <ScrollArea class="flex-1">
        <div class="p-4 space-y-6">
            <!-- Info Section -->
            <div class="space-y-1">
                <h3 class="font-medium text-lg leading-none">{{ device.name }}</h3>
                <p class="text-sm text-muted-foreground font-mono">{{ device.manufacturer }}</p>
                <div class="flex gap-2 mt-2">
                    <Badge variant="outline">{{ device.ip }}</Badge>
                    <Badge variant="secondary">{{ device.type }}</Badge>
                </div>
            </div>

            <Separator />

            <!-- Login / Tabs -->
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

            <div v-else>
                <!-- Tabs -->
                <div class="flex items-center gap-1 mb-4 p-1 bg-muted rounded-lg">
                    <button class="flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1" :class="activeTab === 'info' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'" @click="activeTab = 'info'">
                        <Info class="w-3 h-3" /> 信息
                    </button>
                    <button class="flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1" :class="activeTab === 'network' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'" @click="activeTab = 'network'">
                        <Network class="w-3 h-3" /> 网络
                    </button>
                    <button class="flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1" :class="activeTab === 'maintenance' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'" @click="activeTab = 'maintenance'">
                        <Wrench class="w-3 h-3" /> 维护
                    </button>
                </div>

                <!-- Tab: Device Info -->
                <div v-show="activeTab === 'info'" class="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div v-if="deviceInfo" class="space-y-4">
                        <div class="p-3 bg-muted/30 rounded-lg border">
                            <div class="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                                <span class="text-muted-foreground">厂商</span> <span class="font-medium text-right truncate">{{ deviceInfo.manufacturer }}</span>
                                <span class="text-muted-foreground">型号</span> <span class="font-medium text-right truncate">{{ deviceInfo.model }}</span>
                                <span class="text-muted-foreground">固件版本</span> <span class="font-medium text-right truncate">{{ deviceInfo.firmwareVersion }}</span>
                                <span class="text-muted-foreground">序列号</span> <span class="font-medium text-right truncate">{{ deviceInfo.serialNumber }}</span>
                                <span class="text-muted-foreground">硬件 ID</span> <span class="font-medium text-right truncate">{{ deviceInfo.hardwareId }}</span>
                                <span v-if="protocols" class="text-muted-foreground">HTTP 端口</span> <span v-if="protocols" class="font-medium text-right font-mono">{{ protocols.http }}</span>
                                <span v-if="protocols" class="text-muted-foreground">RTSP 端口</span> <span v-if="protocols" class="font-medium text-right font-mono">{{ protocols.rtsp }}</span>
                            </div>
                        </div>

                        <Button variant="outline" class="w-full" @click="openWebPage">
                            <ExternalLink class="w-4 h-4 mr-2" />
                            打开网页管理
                        </Button>

                        <LivePlayer 
                            :stream-url="streamUrl"
                            :snapshot-url="snapshotUrl"
                            :is-loading="isSnapshotLoading"
                            :is-live="isLive"
                            @toggle-live="handleToggleLive"
                            @refresh-snapshot="handleFetchSnapshot"
                        />
                        <div v-if="streamUrl && streamUrl.startsWith('rtsp')" class="mt-2 p-2 bg-muted rounded text-[10px] font-mono break-all flex items-center justify-between">
                            <span>{{ streamUrl }}</span>
                            <Button variant="ghost" size="sm" class="h-5 px-2 text-[10px]" @click="copyToClipboard(streamUrl)">复制</Button>
                        </div>
                    </div>
                </div>

                <!-- Tab: Network -->
                <div v-show="activeTab === 'network'" class="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-sm font-medium text-primary"><Network class="w-4 h-4" /> IP 设置</div>
                        <Button variant="ghost" size="icon" class="h-6 w-6" @click="handleRefreshNetwork" :disabled="networkLoading"><RefreshCw class="w-3 h-3" :class="{'animate-spin': networkLoading}" /></Button>
                    </div>
                    <div class="space-y-4 p-4 border rounded-lg bg-card/50">
                        <div class="flex items-center justify-between"><label class="text-sm font-medium">启用 DHCP</label><Switch v-model:checked="networkConfig.dhcp" /></div>
                        <div class="space-y-3">
                            <div class="space-y-1"><label class="text-xs font-medium">IP 地址</label><Input v-model="networkConfig.ip" :disabled="networkConfig.dhcp" class="font-mono" /></div>
                            <div class="space-y-1"><label class="text-xs font-medium">子网掩码</label><Input v-model="networkConfig.subnet" :disabled="networkConfig.dhcp" class="font-mono" /></div>
                            <div class="space-y-1"><label class="text-xs font-medium">默认网关</label><Input v-model="networkConfig.gateway" :disabled="networkConfig.dhcp" class="font-mono" /></div>
                        </div>
                        <Button class="w-full" @click="handleSaveNetwork" :disabled="networkLoading"><Save v-if="!networkLoading" class="w-4 h-4 mr-2" /><Loader2 v-else class="w-4 h-4 mr-2 animate-spin" /> 保存配置</Button>
                    </div>
                </div>

                <!-- Tab: Maintenance -->
                <div v-show="activeTab === 'maintenance'" class="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div class="space-y-4 p-4 border rounded-lg bg-red-500/5 border-red-500/20">
                        <div class="flex items-start gap-3">
                            <div class="p-2 bg-red-500/10 rounded-md text-red-500"><Power class="w-5 h-5" /></div>
                            <div><h4 class="text-sm font-medium text-red-700">系统重启</h4><p class="text-xs text-red-600/80 mt-1">重启设备可能会导致服务暂时中断。</p></div>
                        </div>
                        <Button variant="destructive" class="w-full" @click="handleReboot">立即重启</Button>
                    </div>
                    <div class="space-y-4 p-4 border rounded-lg bg-card/50">
                        <div class="flex items-center gap-2 text-sm font-medium"><Clock class="w-4 h-4" /> 时间设置</div>
                        <div class="flex items-center justify-between text-xs p-2 bg-muted rounded-md"><span class="text-muted-foreground">设备时间</span><span class="font-mono font-medium">{{ deviceTime || '未知' }}</span></div>
                        <Button variant="outline" class="w-full" @click="handleSyncTime">同步本机时间</Button>
                    </div>
                    <div class="space-y-4 p-4 border rounded-lg bg-card/50">
                        <div class="flex items-center gap-2 text-sm font-medium"><Lock class="w-4 h-4" /> 修改密码</div>
                        <div class="space-y-3">
                            <div class="space-y-1"><label class="text-xs font-medium">新密码</label><Input v-model="passwordForm.newPassword" type="password" placeholder="••••••" /></div>
                            <div class="space-y-1"><label class="text-xs font-medium">确认密码</label><Input v-model="passwordForm.confirmPassword" type="password" placeholder="••••••" /></div>
                            <Button class="w-full" variant="outline" @click="handleChangePassword" :disabled="!passwordForm.newPassword">提交修改</Button>
                        </div>
                    </div>
                </div>
                
                <Separator class="my-4" />
                <Button variant="outline" class="w-full text-muted-foreground" size="sm" @click="isLoggedIn = false">退出登录</Button>
            </div>
        </div>
    </ScrollArea>
  </Card>
</template>
