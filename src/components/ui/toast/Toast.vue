<script setup lang="ts">
import { ref } from 'vue'
import ToastItem from './ToastItem.vue'

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
  duration?: number
}

const messages = ref<ToastMessage[]>([])
let idCounter = 0

const MAX_MESSAGES = 5

function add(message: Omit<ToastMessage, 'id'>) {
  const id = idCounter++
  const toast: ToastMessage = { ...message, id }
  
  if (messages.value.length >= MAX_MESSAGES) {
    messages.value.shift()
  }
  
  messages.value.push(toast)
  return id
}

function remove(id: number) {
  const index = messages.value.findIndex(m => m.id === id)
  if (index > -1) {
    messages.value.splice(index, 1)
  }
}

function success(message: string, duration?: number, description?: string) {
  return add({ type: 'success', message, duration: duration || 3000, description })
}

function error(message: string, duration?: number, description?: string) {
  return add({ type: 'error', message, duration: duration || 5000, description })
}

function warning(message: string, duration?: number, description?: string) {
  return add({ type: 'warning', message, duration: duration || 3000, description })
}

function info(message: string, duration?: number, description?: string) {
  return add({ type: 'info', message, duration: duration || 3000, description })
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
  <div class="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <ToastItem
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        class="pointer-events-auto"
        @close="remove"
      />
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
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}
</style>