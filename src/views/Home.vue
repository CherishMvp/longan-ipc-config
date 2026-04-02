<script setup lang="ts">
import { useDeviceStore } from '@/stores/device'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Monitor, 
  Wifi, 
  WifiOff, 
  Settings2, 
  ArrowRight, 
  Activity,
  Cpu,
  MonitorPlay,
  Settings
} from 'lucide-vue-next'

const store = useDeviceStore()

const features = [
  {
    title: '视频监控',
    desc: '实时视频墙，支持多路同时播放，自动发现设备通道',
    icon: MonitorPlay,
    path: '/video-wall',
    status: 'new'
  },
  {
    title: '气体配置',
    desc: 'IPC 气体传感器配置管理，支持批量同步与下发',
    icon: Settings2,
    path: '/gas-config',
    status: 'stable'
  },
  {
    title: '设备发现',
    desc: 'ONVIF 协议扫描局域网设备，一键导入管理',
    icon: Wifi,
    path: '/discovery',
    status: 'stable'
  },
  {
    title: '系统设置',
    desc: 'WVP 视频平台、ONVIF 认证等全局配置',
    icon: Settings,
    path: '/settings',
    status: 'stable'
  }
]

const stats = [
  { 
    label: '设备总数', 
    value: () => store.devices.length, 
    icon: Monitor,
    variant: 'default' as const
  },
  { 
    label: '在线设备', 
    value: () => store.devices.filter(d => d.status === 'online').length, 
    icon: Wifi,
    variant: 'success' as const,
    class: 'text-green-500 bg-green-500/10'
  },
  { 
    label: '离线设备', 
    value: () => store.devices.filter(d => d.status === 'offline').length, 
    icon: WifiOff,
    variant: 'destructive' as const,
    class: 'text-red-500 bg-red-500/10'
  }
]
</script>

<template>
  <div class="space-y-8 p-1">
<!-- Hero Section -->
    <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/90 to-primary p-8 text-primary-foreground shadow-lg">
      <div class="relative z-10">
        <div class="flex items-start gap-4">
          <div class="p-3 bg-white/10 backdrop-blur-sm rounded-xl">
            <Cpu class="w-8 h-8" />
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight mb-2">Longan IPC Tools</h1>
            <p class="text-primary-foreground/80 max-w-xl leading-relaxed">
              一站式 IPC 设备管理平台。集成视频监控、气体传感器配置、设备发现等功能，支持批量操作与实时监控。
            </p>
          </div>
        </div>
      </div>
      
      <!-- Decorative background elements -->
      <div class="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/10 rounded-full blur-2xl"></div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card v-for="stat in stats" :key="stat.label" class="overflow-hidden border-none shadow-md bg-card/50 hover:bg-card transition-colors">
        <CardContent class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground mb-1">{{ stat.label }}</p>
              <div class="flex items-baseline gap-2">
                <span class="text-3xl font-bold tracking-tight">{{ stat.value() }}</span>
                <span class="text-xs text-muted-foreground" v-if="stat.label === '设备总数'">台</span>
              </div>
            </div>
            <div :class="['p-3 rounded-xl', stat.class || 'bg-primary/10 text-primary']">
              <component :is="stat.icon" class="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Quick Access / Features -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Activity class="w-5 h-5 text-primary" />
          功能入口
        </h2>
      </div>
      
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RouterLink
          v-for="feature in features"
          :key="feature.path"
          :to="feature.path"
          class="group block h-full"
        >
          <Card class="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 cursor-pointer group-hover:-translate-y-1">
            <CardHeader>
              <div class="flex items-start justify-between">
                <div class="p-2.5 rounded-lg bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <component :is="feature.icon" class="w-6 h-6" />
                </div>
                <Badge 
                  v-if="feature.status === 'new'" 
                  variant="outline" 
                  class="border-green-500 text-green-500"
                >
                  NEW
                </Badge>
              </div>
              <CardTitle class="mt-4">{{ feature.title }}</CardTitle>
              <CardDescription class="line-clamp-2 mt-2">{{ feature.desc }}</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="flex items-center text-sm text-primary font-medium opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                进入功能 <ArrowRight class="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
