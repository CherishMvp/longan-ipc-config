<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import type { ToastMessage } from './Toast.vue'

const props = defineProps<{
  message: ToastMessage
}>()

const emit = defineEmits<{
  (e: 'close', id: number): void
}>()

const isPaused = ref(false)
let timer: number | null = null
let remainingTime = props.message.duration || 3000
let startTime = Date.now()

function getIcon(type: string) {
  switch (type) {
    case 'success': return CheckCircle2
    case 'error': return XCircle
    case 'warning': return AlertTriangle
    case 'info': return Info
    default: return Info
  }
}

function getIconColor(type: string) {
  switch (type) {
    case 'success': return 'text-green-500'
    case 'error': return 'text-red-500'
    case 'warning': return 'text-yellow-500'
    case 'info': return 'text-blue-500'
    default: return 'text-blue-500'
  }
}

function startTimer() {
  if (timer) clearTimeout(timer)
  startTime = Date.now()
  timer = window.setTimeout(() => {
    emit('close', props.message.id)
  }, remainingTime)
}

function pauseTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
    remainingTime -= Date.now() - startTime
  }
  isPaused.value = true
}

function resumeTimer() {
  if (isPaused.value) {
    startTimer()
    isPaused.value = false
  }
}

function handleClose() {
  if (timer) clearTimeout(timer)
  emit('close', props.message.id)
}

onMounted(() => {
  startTimer()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div
    class="flex items-start gap-3 p-4 rounded-lg shadow-lg border bg-background text-foreground min-w-[300px] max-w-[500px] transition-all duration-300"
    :class="{
      'border-green-500/50': message.type === 'success',
      'border-red-500/50': message.type === 'error',
      'border-yellow-500/50': message.type === 'warning',
      'border-blue-500/50': message.type === 'info'
    }"
    @mouseenter="pauseTimer"
    @mouseleave="resumeTimer"
  >
    <component
      :is="getIcon(message.type)"
      class="w-5 h-5 flex-shrink-0"
      :class="getIconColor(message.type)"
    />
    
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium">{{ message.message }}</p>
      <p v-if="message.description" class="text-xs text-muted-foreground mt-1">
        {{ message.description }}
      </p>
    </div>
    
    <button
      class="flex-shrink-0 p-1 rounded-sm hover:bg-muted transition-colors"
      @click="handleClose"
    >
      <X class="w-4 h-4 text-muted-foreground hover:text-foreground" />
    </button>
  </div>
</template>