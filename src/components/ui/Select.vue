<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'

interface Props {
  modelValue?: string | number
  disabled?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  change: [event: Event]
}>()

const classes = computed(() => [
  'flex h-9 w-full items-center justify-between rounded-md border border-input',
  'bg-background px-3 py-2 text-sm ring-offset-background',
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
  'focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  'cursor-pointer appearance-none transition-colors',
  'bg-[url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")]',
  'bg-[position:right_0.5rem_center] bg-[size:1.5em_1.5em] bg-no-repeat pr-10',
  props.class
])

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
  emit('change', event)
}
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    :class="classes"
    @change="handleChange"
  >
    <slot />
  </select>
</template>

<style scoped>
.border-input { border-color: hsl(var(--input)); }
.bg-background { background-color: hsl(var(--background)); }
.ring-offset-background { --tw-ring-offset-color: hsl(var(--background)); }
.focus\:ring-ring:focus { --tw-ring-color: hsl(var(--ring)); }
</style>
