<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Theme, applyTheme, storedTheme, toggleTheme } from './utils/theme'
import PwaNotices from './components/PwaNotices.vue'

const theme = ref<Theme>(Theme.Light)

onMounted(() => {
  theme.value = storedTheme()
  applyTheme(theme.value)
})

function onToggleTheme() {
  theme.value = toggleTheme()
}
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="app-header">
    <RouterLink class="app-brand" to="/invoices">Invoice</RouterLink>

    <nav class="app-nav" aria-label="Main">
      <RouterLink to="/invoices">Invoices</RouterLink>
      <RouterLink to="/clients">Clients</RouterLink>
    </nav>

    <button
      type="button"
      class="btn btn-secondary app-theme"
      :aria-pressed="theme === Theme.Dark"
      aria-label="Toggle dark theme"
      @click="onToggleTheme"
    >
      {{ theme === Theme.Dark ? 'Light' : 'Dark' }}
    </button>
  </header>

  <PwaNotices />

  <main id="main" class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
/**
 * Mobile first: base rules target a narrow screen and `min-width` queries add
 * room as it becomes available. Industry ships no media queries, so every
 * responsive rule in this app is ours.
 *
 * The header is one wrapping flex row. On a narrow screen the brand and theme
 * toggle share the first line and the nav takes the second; once there is room,
 * all three sit on one line in document order.
 */

.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) 0;
  border-bottom: 1px solid var(--color-divider);
}

.app-brand {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: 20px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text);
  text-decoration: none;
}

.app-theme {
  /* Sits at the right end: beside the brand while the nav is wrapped below,
     and after the nav once all three share a line. */
  margin-left: auto;
  order: 0;
  min-height: 44px;
}

.app-nav {
  display: flex;
  gap: var(--space-2);
  /* Full width, so it wraps onto its own line below the brand. */
  flex-basis: 100%;
  order: 1;
  overflow-x: auto;
  scrollbar-width: none;
}

.app-nav::-webkit-scrollbar {
  display: none;
}

.app-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  white-space: nowrap;
  color: var(--color-text);
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.app-nav a:hover {
  background: color-mix(in srgb, var(--color-text) 6%, transparent);
}

.app-nav a.router-link-active {
  border-bottom-color: var(--color-accent);
  color: var(--color-accent-text);
}

.app-main {
  padding: var(--space-4);
}

@media (min-width: 40rem) {
  .app-header {
    gap: var(--space-6);
    padding: var(--space-2) var(--space-6) 0;
  }

  .app-nav {
    /* Back into document order: brand, nav, toggle on one line. */
    flex-basis: auto;
    order: 0;
    flex: 1;
  }

  .app-main {
    padding: var(--space-6);
  }
}

@media (min-width: 64rem) {
  .app-main {
    max-width: 78rem;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
}
</style>
