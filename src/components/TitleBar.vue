<script setup lang="ts">
import { ref } from 'vue'
import { Minus, Square, X, Copy, Bug } from 'lucide-vue-next'

const isMaximized = ref(false)

const minimize = async () => {
  console.log('[TitleBar] Minimize clicked')
  if (window.electronAPI?.minimize) {
    const success = await window.electronAPI.minimize()
    console.log('[TitleBar] Minimize IPC success:', success)
  } else {
    console.error('[TitleBar] electronAPI.minimize not found')
  }
}

const toggleMaximize = async () => {
  console.log('[TitleBar] Maximize clicked')
  if (window.electronAPI?.toggleMaximize) {
    const success = await window.electronAPI.toggleMaximize()
    console.log('[TitleBar] Maximize IPC success:', success)
    isMaximized.value = !isMaximized.value
  }
}

const closeApp = async () => {
  console.log('[TitleBar] Close clicked')
  if (window.electronAPI?.close) {
    await window.electronAPI.close()
  }
}
</script>

<template>
  <div class="h-10 flex items-center justify-between bg-background border-b border-border select-none relative z-[9999]">
    
    <!-- Drag Area -->
    <div class="flex-1 h-full flex items-center gap-2 px-3 text-xs font-medium text-muted-foreground drag-region">
      <div class="w-4 h-4 bg-primary rounded-sm flex items-center justify-center text-[8px] text-primary-foreground font-bold">
        L
      </div>
      <span>Longan IPC Tools</span>
    </div>

    <!-- Button Area -->
    <div class="flex h-full no-drag items-center pr-1">
      <!-- Debug Button -->
      <button 
        @click="minimize" 
        class="h-8 w-8 flex items-center justify-center bg-red-500 text-white rounded-full mr-2 hover:bg-red-600 transition-colors pointer-events-auto"
        style="-webkit-app-region: no-drag;"
      >
        <Bug class="w-4 h-4" />
      </button>

      <button 
        @click="minimize" 
        class="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-foreground text-muted-foreground transition-colors outline-none cursor-pointer pointer-events-auto"
        style="-webkit-app-region: no-drag;"
      >
        <Minus class="w-4 h-4" />
      </button>
      <button 
        @click="toggleMaximize" 
        class="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-foreground text-muted-foreground transition-colors outline-none cursor-pointer pointer-events-auto"
        style="-webkit-app-region: no-drag;"
      >
        <Square v-if="!isMaximized" class="w-3.5 h-3.5" />
        <Copy v-else class="w-3.5 h-3.5 rotate-180" />
      </button>
      <button 
        @click="closeApp" 
        class="h-full w-12 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors outline-none cursor-pointer pointer-events-auto"
        style="-webkit-app-region: no-drag;"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.drag-region {
  -webkit-app-region: drag !important;
}
.no-drag {
  -webkit-app-region: no-drag !important;
}
</style>
