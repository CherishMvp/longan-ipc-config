<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'

interface Props {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  loading?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
  success: 'bg-success text-success-foreground hover:bg-success/90'
}

const sizeClasses = {
  default: 'h-9 px-4 py-2',
  sm: 'h-7 px-3 text-xs',
  lg: 'h-11 px-8',
  icon: 'h-9 w-9'
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
  'ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2',
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  'cursor-pointer select-none',
  variantClasses[props.variant],
  sizeClasses[props.size],
  props.class
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="i-lucide-loader-2 h-4 w-4 animate-spin" />
    <slot />
  </button>
</template>

<style scoped>
.bg-primary { background-color: hsl(var(--primary)); }
.text-primary-foreground { color: hsl(var(--primary-foreground)); }
.bg-destructive { background-color: hsl(var(--destructive)); }
.text-destructive-foreground { color: hsl(var(--destructive-foreground)); }
.bg-secondary { background-color: hsl(var(--secondary)); }
.text-secondary-foreground { color: hsl(var(--secondary-foreground)); }
.bg-success { background-color: hsl(var(--success)); }
.text-success-foreground { color: hsl(var(--success-foreground)); }
.ring-offset-background { --tw-ring-offset-color: hsl(var(--background)); }
.focus-visible\:ring-ring:focus-visible { --tw-ring-color: hsl(var(--ring)); }
</style>
