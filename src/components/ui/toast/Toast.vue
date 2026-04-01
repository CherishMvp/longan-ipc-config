<script setup lang="ts">
import { ref } from 'vue'

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

const messages = ref<ToastMessage[]>([])
let idCounter = 0

function add(message: Omit<ToastMessage, 'id'>) {
  const id = idCounter++
  const toast: ToastMessage = { ...message, id }
  messages.value.push(toast)
  
  // 自动移除
  const duration = message.duration || 3000
  setTimeout(() => {
    remove(id)
  }, duration)
  
  return id
}

function remove(id: number) {
  const index = messages.value.findIndex(m => m.id === id)
  if (index > -1) {
    messages.value.splice(index, 1)
  }
}

function success(message: string, duration?: number) {
  return add({ type: 'success', message, duration })
}

function error(message: string, duration?: number) {
  return add({ type: 'error', message, duration: duration || 5000 })
}

function warning(message: string, duration?: number) {
  return add({ type: 'warning', message, duration })
}

function info(message: string, duration?: number) {
  return add({ type: 'info', message, duration })
}

function getIcon(type: string) {
  switch (type) {
    case 'success': return '✓'
    case 'error': return '✗'
    case 'warning': return '⚠'
    case 'info': return 'ℹ'
    default: return ''
  }
}

function getColorClass(type: string) {
  switch (type) {
    case 'success': return 'bg-green-500'
    case 'error': return 'bg-red-500'
    case 'warning': return 'bg-yellow-500'
    case 'info': return 'bg-blue-500'
    default: return 'bg-gray-500'
  }
}

defineExpose({
  add,
  remove,
  success,
  error,
  warning,
  info
})
</script>

<template>
  <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] max-w-[500px]"
        :class="getColorClass(msg.type)"
      >
        <span class="text-lg font-bold">{{ getIcon(msg.type) }}</span>
        <span class="flex-1 text-sm">{{ msg.message }}</span>
        <button 
          class="text-white/80 hover:text-white text-xl leading-none"
          @click="remove(msg.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active {
  animation: slideIn 0.3s ease-out;
}

.toast-leave-active {
  animation: slideOut 0.3s ease-in;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>