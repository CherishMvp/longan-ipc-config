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
      'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
      $props.class
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
.bg-card { background-color: hsl(var(--card)); }
.text-card-foreground { color: hsl(var(--card-foreground)); }
.border-border { border-color: hsl(var(--border)); }
</style>
