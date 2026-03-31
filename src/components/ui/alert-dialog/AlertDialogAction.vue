<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { DialogClose } from 'radix-vue'
import { buttonVariants } from '@/components/ui/button'
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
  <DialogClose
    :class="cn(buttonVariants({ variant: 'default' }), 'mt-2 sm:mt-0', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogClose>
</template>
