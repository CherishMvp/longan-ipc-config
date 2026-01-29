<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Download, Cloud, Loader2, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// State
const status = ref<'idle' | 'checking' | 'available' | 'downloading' | 'ready'>('idle')
const message = ref('')
const progress = ref(0)
const versionInfo = ref<any>(null)

onMounted(() => {
  if (window.electronAPI) {
    // Listen for messages
    window.electronAPI.onUpdaterMessage((data: any) => {
      console.log('[Updater]', data)
      if (data.type === 'checking') {
        status.value = 'checking'
        message.value = data.msg
      } else if (data.type === 'available') {
        status.value = 'available'
        message.value = data.msg
        versionInfo.value = data.info
      } else if (data.type === 'not-available') {
        status.value = 'idle'
        message.value = data.msg
        setTimeout(() => message.value = '', 3000)
      } else if (data.type === 'downloaded') {
        status.value = 'ready'
        message.value = '更新已就绪'
      } else if (data.type === 'error') {
        status.value = 'idle'
        message.value = data.msg // Show error briefly
      }
    })

    // Listen for progress
    window.electronAPI.onUpdaterProgress((data: any) => {
      status.value = 'downloading'
      progress.value = data.percent
      message.value = `下载中... ${Math.round(data.percent)}%`
    })
  }
})

const checkUpdate = async () => {
  if (status.value === 'checking' || status.value === 'downloading') return
  status.value = 'checking'
  await window.electronAPI.checkForUpdates()
}

const installUpdate = () => {
  window.electronAPI.quitAndInstall()
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300">
    <!-- Progress Toast -->
    <div v-if="status === 'downloading'" class="bg-background border rounded-lg shadow-lg p-3 w-64">
      <div class="flex items-center justify-between text-xs mb-2">
        <span class="font-medium">下载更新中...</span>
        <span>{{ Math.round(progress) }}%</span>
      </div>
      <Progress :model-value="progress" class="h-2" />
    </div>

    <!-- Ready Toast -->
    <div v-if="status === 'ready'" class="bg-primary text-primary-foreground rounded-lg shadow-lg p-3 w-64 flex flex-col gap-2">
      <div class="flex items-center gap-2 font-medium text-sm">
        <Check class="w-4 h-4" />
        <span>新版本已就绪</span>
      </div>
      <p class="text-xs opacity-90">v{{ versionInfo?.version }} 已下载完成。</p>
      <Button size="sm" variant="secondary" @click="installUpdate" class="w-full h-8 text-xs">
        立即重启更新
      </Button>
    </div>

    <!-- Status Badge (Optional trigger) -->
    <div v-if="status === 'idle' || status === 'checking'" class="self-end">
      <Button variant="outline" size="sm" class="h-8 text-xs shadow-sm bg-background/80 backdrop-blur" @click="checkUpdate" :disabled="status === 'checking'">
        <Loader2 v-if="status === 'checking'" class="w-3 h-3 mr-2 animate-spin" />
        <Cloud v-else class="w-3 h-3 mr-2" />
        {{ message || '检查更新' }}
      </Button>
    </div>
  </div>
</template>
