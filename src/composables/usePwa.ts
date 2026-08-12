import { ref, shallowRef } from 'vue'
import { requestPersistence, storageEstimate } from '../utils/namespace'
import type { PersistenceOutcome } from '../utils/namespace'

/**
 * Install, durability and updates.
 *
 * These belong together because they are one concern: on WebKit, script-writable
 * storage is cleared after seven days without a visit unless the site is
 * installed to the Home Screen. Installing is therefore not a convenience — it
 * is what stops an invoice history quietly expiring.
 */

export const InstallState = {
  /** Running as an installed app; storage is not on the eviction clock. */
  Installed: 'installed',
  /** The browser offered a prompt we can raise. */
  Available: 'available',
  /** iOS has no install API — Share → Add to Home Screen, by hand. */
  Manual: 'manual',
  /** No install path on this browser. */
  Unavailable: 'unavailable',
} as const
export type InstallState = (typeof InstallState)[keyof typeof InstallState]

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const installState = ref<InstallState>(InstallState.Unavailable)
const persistence = ref<PersistenceOutcome | null>(null)
const updateReady = ref(false)

const deferredPrompt = shallowRef<InstallPromptEvent | null>(null)
let applyUpdate: (() => void) | null = null

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS reports installed state here rather than through display-mode.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

/**
 * Wires up install detection and update notification.
 *
 * `registerUpdates` is handed a callback to invoke when a new worker is waiting;
 * it receives the function that activates it. Registration lives in `main.ts` so
 * this module stays free of the virtual import.
 */
export function initPwa(registerUpdates: (onReady: (apply: () => void) => void) => void) {
  installState.value = isStandalone()
    ? InstallState.Installed
    : isIosSafari()
      ? InstallState.Manual
      : InstallState.Unavailable

  window.addEventListener('beforeinstallprompt', (event) => {
    // Held so the prompt can be raised where it makes sense, not on load.
    event.preventDefault()
    deferredPrompt.value = event as InstallPromptEvent
    installState.value = InstallState.Available
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    installState.value = InstallState.Installed
    void checkPersistence()
  })

  registerUpdates((apply) => {
    applyUpdate = apply
    updateReady.value = true
  })
}

/**
 * Asks for durable storage and records the answer.
 *
 * `denied` is kept distinct rather than folded into a boolean, because it is the
 * case worth telling the user about: it means the history has an expiry date.
 */
async function checkPersistence(): Promise<PersistenceOutcome> {
  const outcome = await requestPersistence()
  persistence.value = outcome
  return outcome
}

export function usePwa() {
  async function promptInstall(): Promise<boolean> {
    const event = deferredPrompt.value
    if (!event) return false

    await event.prompt()
    const { outcome } = await event.userChoice
    deferredPrompt.value = null

    return outcome === 'accepted'
  }

  function update() {
    applyUpdate?.()
    updateReady.value = false
  }

  return {
    installState,
    persistence,
    updateReady,
    promptInstall,
    checkPersistence,
    storageEstimate,
    update,
  }
}
