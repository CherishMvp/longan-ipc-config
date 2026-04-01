import { ref } from 'vue'

const toastRef = ref<any>(null)

export function useToast() {
  function setToastInstance(instance: any) {
    toastRef.value = instance
  }

  function success(message: string, duration?: number) {
    toastRef.value?.success(message, duration)
  }

  function error(message: string, duration?: number) {
    toastRef.value?.error(message, duration)
  }

  function warning(message: string, duration?: number) {
    toastRef.value?.warning(message, duration)
  }

  function info(message: string, duration?: number) {
    toastRef.value?.info(message, duration)
  }

  return {
    setToastInstance,
    success,
    error,
    warning,
    info
  }
}