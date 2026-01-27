<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useDeviceStore } from '@/stores/device'

const route = useRoute()
const store = useDeviceStore()

const menuItems = [
  { path: '/', name: '首页', icon: 'i-lucide-home' },
  { path: '/gas-config', name: 'IPC气体配置', icon: 'i-lucide-settings-2' }
]
</script>

<template>
  <div class="flex h-screen bg-[hsl(var(--background))]">
    <!-- 侧边栏 -->
    <aside class="w-56 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col">
      <!-- Logo区域 -->
      <div class="h-14 flex items-center px-4 border-b border-[hsl(var(--border))]">
        <div class="i-lucide-cpu h-6 w-6 text-[hsl(var(--primary))]" />
        <span class="ml-2.5 font-semibold text-sm tracking-tight">传感器配置工具</span>
      </div>
      
      <!-- 导航菜单 -->
      <nav class="flex-1 py-3 px-2">
        <div class="space-y-1">
          <RouterLink
            v-for="item in menuItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 cursor-pointer"
            :class="[
              route.path === item.path 
                ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] font-medium border-l-2 border-[hsl(var(--primary))] -ml-[2px] pl-[14px]' 
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
            ]"
          >
            <div :class="item.icon" class="h-4 w-4" />
            <span>{{ item.name }}</span>
          </RouterLink>
        </div>
      </nav>
      
      <!-- 底部状态 -->
      <div class="p-3 border-t border-[hsl(var(--border))]">
        <div class="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]"></span>
            <span>{{ store.devices.length }} 台设备</span>
          </div>
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- 顶部栏 -->
      <header class="h-12 border-b border-[hsl(var(--border))] flex items-center justify-between px-5 bg-[hsl(var(--card))]">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-medium">{{ route.meta.title || '首页' }}</h2>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span class="i-lucide-user h-3.5 w-3.5" />
            <span>{{ store.globalConfig.username || 'admin' }}</span>
          </div>
        </div>
      </header>
      
      <!-- 内容区 -->
      <div class="flex-1 overflow-auto p-4 bg-[hsl(var(--background))]">
        <RouterView />
      </div>
    </main>
  </div>
</template>
