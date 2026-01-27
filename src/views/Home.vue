<script setup lang="ts">
import { useDeviceStore } from '@/stores/device'
import { Card, CardContent, Badge } from '@/components/ui'

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
  { label: '设备总数', value: () => store.devices.length, icon: 'i-lucide-monitor' },
  { label: '在线设备', value: () => store.devices.filter(d => d.status === 'online').length, icon: 'i-lucide-wifi', color: 'text-[hsl(var(--success))]' },
  { label: '离线设备', value: () => store.devices.filter(d => d.status === 'offline').length, icon: 'i-lucide-wifi-off', color: 'text-[hsl(var(--destructive))]' }
]
</script>

<template>
  <div class="space-y-4">
    <!-- 欢迎卡片 -->
    <Card>
      <CardContent class="pt-5">
        <div class="flex items-start gap-4">
          <div class="p-3 rounded-lg bg-[hsl(var(--primary)/0.1)]">
            <span class="i-lucide-cpu h-8 w-8 text-[hsl(var(--primary))]" />
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold mb-1">欢迎使用传感器配置工具</h3>
            <p class="text-sm text-[hsl(var(--muted-foreground))]">
              这是一个用于管理各类传感器设备配置的桌面应用程序，支持多种设备类型和配置方式。
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-3 gap-4">
      <Card v-for="stat in stats" :key="stat.label">
        <CardContent class="pt-4 pb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[hsl(var(--muted-foreground))] mb-1">{{ stat.label }}</p>
              <p class="text-2xl font-bold">{{ stat.value() }}</p>
            </div>
            <div :class="[stat.icon, 'h-8 w-8', stat.color || 'text-[hsl(var(--muted-foreground))]']" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 功能入口 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink
        v-for="feature in features"
        :key="feature.path"
        :to="feature.path"
        class="block"
      >
        <Card class="h-full hover:border-[hsl(var(--primary)/0.5)] transition-colors cursor-pointer group">
          <CardContent class="pt-5">
            <div class="flex items-start gap-4">
              <div class="p-2.5 rounded-lg bg-[hsl(var(--primary)/0.1)] group-hover:bg-[hsl(var(--primary)/0.15)] transition-colors">
                <span :class="feature.icon" class="h-6 w-6 text-[hsl(var(--primary))] block group-hover:scale-110 transition-transform" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="font-semibold">{{ feature.title }}</h4>
                  <Badge variant="default" class="text-[10px]">推荐</Badge>
                </div>
                <p class="text-sm text-[hsl(var(--muted-foreground))]">{{ feature.desc }}</p>
              </div>
              <span class="i-lucide-chevron-right h-5 w-5 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] group-hover:translate-x-1 transition-all" />
            </div>
          </CardContent>
        </Card>
      </RouterLink>
    </div>
  </div>
</template>
