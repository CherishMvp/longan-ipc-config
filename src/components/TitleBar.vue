<script setup lang="ts">
import { ref } from 'vue'
import { Minus, Square, X, Copy } from 'lucide-vue-next'

const isMaximized = ref(false)

const minimize = () => {
  console.log('[TitleBar] Minimize clicked')
  if (window.electronAPI) window.electronAPI.minimize()
}

const toggleMaximize = () => {
  console.log('[TitleBar] Maximize clicked')
  if (window.electronAPI) {
    window.electronAPI.toggleMaximize()
    isMaximized.value = !isMaximized.value
  }
}

const closeApp = () => {
  console.log('[TitleBar] Close clicked')
  if (window.electronAPI) window.electronAPI.close()
}
</script>

<template>
  <!-- 
    Root div: 不设 drag，只负责布局和层级
  -->
  <div class="h-8 flex items-center justify-between bg-background border-b border-border select-none relative z-50">
    
    <!-- 
      Drag Area: 只有左侧包含标题的区域可拖拽
      flex-1 确保它占据除了按钮以外的所有空间
    -->
    <div class="flex-1 h-full flex items-center gap-2 px-3 text-xs font-medium text-muted-foreground drag-region">
      <div class="w-4 h-4 bg-primary rounded-sm flex items-center justify-center text-[8px] text-primary-foreground font-bold">
        S
      </div>
      <span>传感器配置工具</span>
    </div>

    <!-- 
      Button Area: 独立于 Drag Area 之外
      不需要 no-drag，因为它不是 drag 元素的子元素
    -->
    <div class="flex h-full no-drag">
      <button 
        @click="minimize" 
        class="h-full w-10 flex items-center justify-center hover:bg-accent hover:text-foreground text-muted-foreground transition-colors outline-none cursor-default"
        title="最小化"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>
      <button 
        @click="toggleMaximize" 
        class="h-full w-10 flex items-center justify-center hover:bg-accent hover:text-foreground text-muted-foreground transition-colors outline-none cursor-default"
        title="最大化/还原"
      >
        <Square v-if="!isMaximized" class="w-3 h-3" />
        <Copy v-else class="w-3 h-3 rotate-180" />
      </button>
      <button 
        @click="closeApp" 
        class="h-full w-10 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors outline-none cursor-default"
        title="关闭"
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
  /* 
    Optional: Just in case there's overlap or layout shift.
    Electron docs recommend avoiding nested drag/no-drag if possible.
    Separating siblings is the safest way.
  */
  -webkit-app-region: no-drag;
}
</style>
