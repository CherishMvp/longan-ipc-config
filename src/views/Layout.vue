<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useDeviceStore } from '@/stores/device'
import { Home, Settings2, Wifi } from 'lucide-vue-next'
import ThemeToggle from '@/components/ThemeToggle.vue'

const route = useRoute()
const store = useDeviceStore()

const menuItems = [
  { path: '/', name: '首页', icon: Home },
  { path: '/discovery', name: '设备自动发现', icon: Wifi },
  { path: '/gas-config', name: 'IPC气体配置', icon: Settings2 }
]
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-foreground font-sans">
    <!-- Sidebar -->
    <aside class="w-60 border-r bg-card flex flex-col transition-all duration-300 ease-in-out">
      <!-- Logo Area -->
      <div class="h-14 flex items-center gap-2 px-6 border-b">
        <div class="w-5 h-5 bg-primary rounded-sm flex items-center justify-center text-[10px] text-primary-foreground font-bold">L</div>
        <span class="font-bold text-sm tracking-tight">Longan IPC Tools</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-3 space-y-1">
        <div class="mb-4 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Menu
        </div>
        <RouterLink
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 group"
          :class="[
            route.path === item.path 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          ]"
        >
          <component :is="item.icon" class="w-4 h-4" />
          <span>{{ item.name }}</span>
        </RouterLink>
      </nav>
      
      <!-- Footer Info -->
      <div class="p-4 mt-auto border-t">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            <span>{{ store.devices.length }} Devices</span>
          </div>
          <span>v1.0.4</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden bg-muted/10 relative">
      <!-- Header -->
      <header class="h-14 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <h2 class="text-sm font-semibold tracking-tight">{{ route.meta.title || 'Dashboard' }}</h2>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-xs text-muted-foreground">
            <span class="w-2 h-2 rounded-full bg-primary"></span>
            {{ store.globalConfig.username || 'admin' }}
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <!-- Content Area -->
      <div class="flex-1 overflow-auto p-6 scroll-smooth">
        <div class="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
          <RouterView />
        </div>
      </div>
    </main>
  </div>
</template>
