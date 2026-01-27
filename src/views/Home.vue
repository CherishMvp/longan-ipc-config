<script setup lang="ts">
import { useDeviceStore } from '@/stores/device'

const store = useDeviceStore()

const features = [
  {
    title: 'IPC气体配置',
    desc: '管理IPC设备的气体传感器配置，支持批量获取和设置',
    icon: 'i-lucide-settings-2',
    path: '/gas-config'
  }
]

const stats = [
  { 
    label: '设备总数', 
    value: () => store.devices.length, 
    icon: 'i-lucide-monitor',
    iconClass: 'text-muted-foreground'
  },
  { 
    label: '在线设备', 
    value: () => store.devices.filter(d => d.status === 'online').length, 
    icon: 'i-lucide-wifi',
    iconClass: 'text-success'
  },
  { 
    label: '离线设备', 
    value: () => store.devices.filter(d => d.status === 'offline').length, 
    icon: 'i-lucide-wifi-off',
    iconClass: 'text-destructive'
  }
]
</script>

<template>
  <div class="dark space-y-4">
    <!-- Welcome Card -->
    <div class="card">
      <div class="card-content pt-4">
        <div class="flex items-start gap-4">
          <div class="p-2.5 rounded-md bg-muted">
            <span class="i-lucide-cpu h-6 w-6 text-foreground" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold mb-1">欢迎使用传感器配置工具</h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
              这是一个用于管理各类传感器设备配置的桌面应用程序，支持多种设备类型和配置方式。
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-3 gap-3">
      <div v-for="stat in stats" :key="stat.label" class="card kpi-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-muted-foreground">{{ stat.label }}</p>
            <p class="kpi-value mt-1">{{ stat.value() }}</p>
          </div>
          <div :class="[stat.icon, 'h-6 w-6', stat.iconClass]" />
        </div>
      </div>
    </div>

    <!-- Feature Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <RouterLink
        v-for="feature in features"
        :key="feature.path"
        :to="feature.path"
        class="card hover:border-foreground/20 transition-colors cursor-pointer group"
      >
        <div class="card-content pt-4">
          <div class="flex items-start gap-3">
            <div class="p-2 rounded-md bg-muted group-hover:bg-muted/80 transition-colors">
              <span :class="feature.icon" class="h-5 w-5 text-foreground" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="text-sm font-medium">{{ feature.title }}</h4>
              </div>
              <p class="text-xs text-muted-foreground">{{ feature.desc }}</p>
            </div>
            <span class="i-lucide-chevron-right h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.text-muted-foreground { color: hsl(var(--muted-foreground)); }
.text-foreground { color: hsl(var(--foreground)); }
.text-success { color: hsl(var(--success)); }
.text-destructive { color: hsl(var(--destructive)); }
.bg-muted { background-color: hsl(var(--muted)); }
.bg-muted\/80 { background-color: hsl(var(--muted) / 0.8); }
.hover\:border-foreground\/20:hover { border-color: hsl(var(--foreground) / 0.2); }
.group-hover\:text-foreground:hover { color: hsl(var(--foreground)); }
</style>
