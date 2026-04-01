import { ref } from 'vue'

const toastRef = ref<any>(null)

export function useToast() {
  function setToastInstance(instance: any) {
    toastRef.value = instance
  }

  function success(message: string, duration?: number, description?: string) {
    toastRef.value?.success(message, duration, description)
  }

  function error(message: string, duration?: number, description?: string) {
    toastRef.value?.error(message, duration, description)
  }

  function warning(message: string, duration?: number, description?: string) {
    toastRef.value?.warning(message, duration, description)
  }

  function info(message: string, duration?: number, description?: string) {
    toastRef.value?.info(message, duration, description)
  }

  return {
    setToastInstance,
    success,
    error,
    warning,
    info
  }
}