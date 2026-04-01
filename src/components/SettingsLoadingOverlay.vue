<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { Loader2 } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="settingsStore.loading"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <div class="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border shadow-lg">
          <Loader2 class="w-8 h-8 animate-spin text-primary" />
          <p class="text-sm text-muted-foreground">{{ settingsStore.loadingMessage }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>