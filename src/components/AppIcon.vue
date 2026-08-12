<script setup lang="ts">
import { computed } from 'vue'
import { ICONS } from '../config/icons'
import type { IconGeometry, IconName } from '../config/icons'

/**
 * An icon from the Industry kit.
 *
 * Light DOM and a plain template, unlike the `<ds-icon>` custom element the kit
 * ships — a second component system running beside Vue buys nothing, and the
 * geometry was the asset rather than the wrapper.
 *
 * `currentColor` means an icon takes the colour of whatever contains it, so no
 * icon needs theme handling of its own.
 *
 * Decorative by default. Pass `label` only when the icon is a control's sole
 * content; with text beside it, announcing "Download download" is worse than
 * announcing nothing.
 */
const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number | string
    label?: string
  }>(),
  { size: 20 },
)

// Widened to the interface: `as const` gives each entry a distinct literal
// type, and the union has no common `circles`/`rects` to read.
const icon = computed<IconGeometry>(() => ICONS[props.name])
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <rect
      v-for="(rect, index) in icon.rects ?? []"
      :key="`r${index}`"
      :x="rect.x"
      :y="rect.y"
      :width="rect.width"
      :height="rect.height"
      :rx="rect.rx"
    />
    <circle
      v-for="(circle, index) in icon.circles ?? []"
      :key="`c${index}`"
      :cx="circle.cx"
      :cy="circle.cy"
      :r="circle.r"
    />
    <path v-for="(d, index) in icon.paths" :key="`p${index}`" :d="d" />
  </svg>
</template>

<style scoped>
svg {
  display: inline-block;
  flex: none;
  vertical-align: middle;
}
</style>
