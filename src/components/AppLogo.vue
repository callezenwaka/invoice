<script setup lang="ts">
/**
 * The Invoice mark — a ruled sheet on a steel field.
 *
 * Geometry from `design/logo.js`, which ships it as a shadow-DOM custom element;
 * only the shape is taken. Fills come from the tokens, so the mark follows the
 * theme rather than carrying its own palette, and it holds at favicon size
 * because it is flat and square-cornered with no radius to lose.
 */
withDefaults(defineProps<{ size?: number; variant?: 'lockup' | 'mark' }>(), {
  size: 22,
  variant: 'lockup',
})
</script>

<template>
  <span class="logo" :style="{ gap: `${Math.round(size * 0.34)}px` }">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect width="24" height="24" fill="var(--color-accent)" />
      <rect x="6" y="4" width="12" height="16" fill="var(--color-bg)" />
      <g fill="var(--color-accent-300)">
        <rect x="8" y="8" width="8.2" height="0.9" />
        <rect x="8" y="10.6" width="8.2" height="0.9" />
        <rect x="8" y="13.2" width="8.2" height="0.9" />
        <rect x="8" y="15.8" width="4.4" height="0.9" />
      </g>
    </svg>

    <span v-if="variant === 'lockup'" class="logo__word" :style="{ fontSize: `${Math.round(size * 0.95)}px` }">
      Invoice
    </span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  color: inherit;
}

.logo__word {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  line-height: 1;
}
</style>
