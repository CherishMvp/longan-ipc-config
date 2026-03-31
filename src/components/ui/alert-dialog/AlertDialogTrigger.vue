<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { DialogTrigger } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DialogTrigger
    :class="cn('', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogTrigger>
</template>
