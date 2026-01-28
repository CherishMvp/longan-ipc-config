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
  Cpu
} from 'lucide-vue-next'

const store = useDeviceStore()

const features = [
  {
    title: 'IPC气体配置',
    desc: '管理IPC设备的气体传感器配置，支持批量获取和设置',
    icon: Settings2,
    path: '/gas-config'
  },
  {
    title: '设备自动发现',
    desc: '基于 ONVIF/私有协议扫描局域网设备，一键导入',
    icon: Wifi,
    path: '/discovery'
  }
]

const stats = [
  { 
    label: 'Total Devices', 
    value: () => store.devices.length, 
    icon: Monitor,
    variant: 'default' as const
  },
  { 
    label: 'Online', 
    value: () => store.devices.filter(d => d.status === 'online').length, 
    icon: Wifi,
    variant: 'success' as const, // Custom variant mapping needed or use class
    class: 'text-green-500 bg-green-500/10'
  },
  { 
    label: 'Offline', 
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
            <h1 class="text-2xl font-bold tracking-tight mb-2">欢迎使用传感器配置工具</h1>
            <p class="text-primary-foreground/80 max-w-xl leading-relaxed">
              这是一个用于管理各类传感器设备配置的专业桌面应用程序。支持批量设备管理、实时状态监控以及参数快速配置。
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
                <span class="text-xs text-muted-foreground" v-if="stat.label === 'Total Devices'">units</span>
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
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <Badge variant="outline" class="group-hover:border-primary/30 transition-colors">v1.0</Badge>
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
