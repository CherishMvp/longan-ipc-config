<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'

interface Props {
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  change: [event: Event]
  blur: [event: FocusEvent]
}>()

const classes = computed(() => [
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
  'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  'transition-colors',
  props.class
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="classes"
    @input="handleInput"
    @change="$emit('change', $event)"
    @blur="$emit('blur', $event)"
  />
</template>

<style scoped>
.border-input { border-color: hsl(var(--input)); }
.bg-background { background-color: hsl(var(--background)); }
.ring-offset-background { --tw-ring-offset-color: hsl(var(--background)); }
.placeholder\:text-muted-foreground::placeholder { color: hsl(var(--muted-foreground)); }
.focus-visible\:ring-ring:focus-visible { --tw-ring-color: hsl(var(--ring)); }
</style>
