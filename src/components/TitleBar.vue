<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Minus, Square, X, Copy } from 'lucide-vue-next'

const isMaximized = ref(false)

const minimize = () => {
  if (window.electronAPI) window.electronAPI.minimize()
}

const toggleMaximize = () => {
  if (window.electronAPI) {
    window.electronAPI.toggleMaximize()
    // Update state based on actual window state if possible, 
    // strictly we'd need an event listener from main process, 
    // but toggling local state is a good approximation for UI
    isMaximized.value = !isMaximized.value
  }
}

const closeApp = () => {
  if (window.electronAPI) window.electronAPI.close()
}
</script>

<template>
  <div class="h-8 flex items-center justify-between bg-background border-b border-border select-none drag-region">
    <!-- Title / Icon -->
    <div class="flex items-center gap-2 px-3 text-xs font-medium text-muted-foreground no-drag">
      <div class="w-4 h-4 bg-primary rounded-sm flex items-center justify-center text-[8px] text-primary-foreground font-bold">
        S
      </div>
      <span>传感器配置工具</span>
    </div>

    <!-- Window Controls -->
    <div class="flex h-full no-drag">
      <button 
        @click="minimize" 
        class="h-full w-10 flex items-center justify-center hover:bg-accent hover:text-foreground text-muted-foreground transition-colors outline-none"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>
      <button 
        @click="toggleMaximize" 
        class="h-full w-10 flex items-center justify-center hover:bg-accent hover:text-foreground text-muted-foreground transition-colors outline-none"
      >
        <Square v-if="!isMaximized" class="w-3 h-3" />
        <Copy v-else class="w-3 h-3 rotate-180" /> <!-- Fallback icon for restore -->
      </button>
      <button 
        @click="closeApp" 
        class="h-full w-10 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors outline-none"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.drag-region {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
</style>
