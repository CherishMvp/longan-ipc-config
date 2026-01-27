<script setup lang="ts">
import { type HTMLAttributes } from 'vue'

interface Props {
  class?: HTMLAttributes['class']
}

defineProps<Props>()
</script>

<template>
  <div
    :class="[
      'flex items-center justify-between p-4 pb-3',
      $props.class
    ]"
  >
    <slot />
  </div>
</template>
