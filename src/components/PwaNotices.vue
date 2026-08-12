<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { InstallState, usePwa } from '../composables/usePwa'

/**
 * Install and update notices.
 *
 * The install nudge is not decoration. On WebKit, script-writable storage is
 * cleared after seven days without a visit unless the app is installed — so an
 * uninstalled app on iOS has an invoice history with an expiry date, and the
 * only way to say so is to ask.
 */

const { installState, persistence, updateReady, promptInstall, checkPersistence, update } = usePwa()

const dismissed = ref(false)

onMounted(() => {
  void checkPersistence()
})

const atRisk = computed(
  () =>
    !dismissed.value &&
    installState.value !== InstallState.Installed &&
    // Chrome often grants persistence without an install; there is nothing to
    // warn about when it has.
    persistence.value?.status !== 'persisted',
)

const canPrompt = computed(() => installState.value === InstallState.Available)
const manualOnly = computed(() => installState.value === InstallState.Manual)

async function onInstall() {
  if (await promptInstall()) dismissed.value = true
}
</script>

<template>
  <div v-if="updateReady" class="notice notice--update" role="status">
    <p>A new version is ready.</p>
    <button type="button" class="btn btn-primary" @click="update">Reload</button>
  </div>

  <div v-if="atRisk" class="notice" role="status">
    <div class="notice__body">
      <p v-if="manualOnly">
        <strong>Install this app to keep your invoices.</strong>
        On iOS, tap Share and then <em>Add to Home Screen</em>. Without it, this browser
        deletes stored data after seven days without a visit.
      </p>
      <p v-else>
        <strong>Install this app to keep your invoices.</strong>
        Browsers may clear stored data for sites that are not installed.
      </p>
    </div>

    <div class="notice__actions">
      <button v-if="canPrompt" type="button" class="btn btn-primary" @click="onInstall">
        Install
      </button>
      <button type="button" class="btn btn-secondary" @click="dismissed = true">Dismiss</button>
    </div>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-accent-100);
  color: var(--color-accent-900);
  font-size: 14px;
}

.notice--update {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.notice p {
  margin: 0;
}

.notice__actions {
  display: flex;
  gap: var(--space-2);
}

.notice__actions .btn,
.notice--update .btn {
  min-height: 44px;
}

@media (min-width: 40rem) {
  .notice {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
