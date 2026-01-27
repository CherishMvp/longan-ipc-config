<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'

interface Props {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})

const variantClasses = {
  default: 'bg-primary/15 text-primary border-transparent',
  secondary: 'bg-secondary text-secondary-foreground border-transparent',
  destructive: 'bg-destructive/15 text-destructive border-transparent',
  outline: 'bg-transparent text-foreground border-border',
  success: 'bg-success/15 text-success border-transparent',
  warning: 'bg-warning/15 text-warning border-transparent'
}

const classes = computed(() => [
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  variantClasses[props.variant],
  props.class
])
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>

<style scoped>
.text-primary { color: hsl(var(--primary)); }
.text-secondary-foreground { color: hsl(var(--secondary-foreground)); }
.text-destructive { color: hsl(var(--destructive)); }
.text-foreground { color: hsl(var(--foreground)); }
.text-success { color: hsl(var(--success)); }
.text-warning { color: hsl(var(--warning)); }
.bg-primary\/15 { background-color: hsl(var(--primary) / 0.15); }
.bg-secondary { background-color: hsl(var(--secondary)); }
.bg-destructive\/15 { background-color: hsl(var(--destructive) / 0.15); }
.bg-success\/15 { background-color: hsl(var(--success) / 0.15); }
.bg-warning\/15 { background-color: hsl(var(--warning) / 0.15); }
.border-border { border-color: hsl(var(--border)); }
</style>
