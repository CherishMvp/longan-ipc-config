<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useDeviceStore } from '@/stores/device'

const route = useRoute()
const store = useDeviceStore()

const menuItems = [
  { path: '/', name: '首页', icon: 'i-lucide-house' },
  { path: '/gas-config', name: 'IPC气体配置', icon: 'i-lucide-settings-2' }
]
</script>

<template>
  <div class="dark flex h-screen bg-background text-foreground">
    <!-- Sidebar - shadcn style -->
    <aside class="w-56 border-r border-border flex flex-col bg-background">
      <!-- Logo -->
      <div class="h-14 flex items-center gap-2 px-4 border-b border-border">
        <div class="i-lucide-cpu h-5 w-5 text-foreground" />
        <span class="font-semibold text-sm">传感器配置工具</span>
      </div>
      
      <!-- Navigation -->
      <nav class="flex-1 p-2">
        <div class="space-y-1">
          <RouterLink
            v-for="item in menuItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors"
            :class="[
              route.path === item.path 
                ? 'bg-accent text-accent-foreground font-medium sidebar-link-active' 
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            ]"
          >
            <div :class="item.icon" class="h-4 w-4" />
            <span>{{ item.name }}</span>
          </RouterLink>
        </div>
      </nav>
      
      <!-- Footer -->
      <div class="p-3 border-t border-border">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <div class="flex items-center gap-2">
            <span class="status-dot status-dot-online"></span>
            <span>{{ store.devices.length }} 台设备</span>
          </div>
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="h-14 border-b border-border flex items-center justify-between px-6 bg-background">
        <h2 class="text-sm font-medium">{{ route.meta.title || '首页' }}</h2>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span class="i-lucide-user h-3.5 w-3.5" />
          <span>{{ store.globalConfig.username || 'admin' }}</span>
        </div>
      </header>
      
      <!-- Content Area -->
      <div class="flex-1 overflow-auto p-4 bg-muted/40">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.bg-background { background-color: hsl(var(--background)); }
.text-foreground { color: hsl(var(--foreground)); }
.border-border { border-color: hsl(var(--border)); }
.bg-accent { background-color: hsl(var(--accent)); }
.text-accent-foreground { color: hsl(var(--accent-foreground)); }
.text-muted-foreground { color: hsl(var(--muted-foreground)); }
.hover\:bg-accent:hover { background-color: hsl(var(--accent)); }
.hover\:text-accent-foreground:hover { color: hsl(var(--accent-foreground)); }
.bg-muted\/40 { background-color: hsl(var(--muted) / 0.4); }
</style>
