/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

/**
 * The service worker.
 *
 * The app makes no network calls of its own — invoices, clients and the PDF
 * generator are all local — so caching the shell is the whole job. Once it is
 * cached the app works offline entirely, which is the point: an invoicing tool
 * that needs a connection to show you what you have invoiced is not much use on
 * a train.
 */

declare const self: ServiceWorkerGlobalScope

// Injected at build time by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/**
 * Deep links are client-side routes, so every navigation resolves to the shell
 * and vue-router takes it from there. Without this, reloading `/invoices/:id`
 * offline would miss.
 */
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

/**
 * Activate a waiting worker only when the page asks.
 *
 * `registerType: 'prompt'` means the user is told an update is ready rather than
 * having the app swap underneath them — reloading mid-invoice would lose an
 * unsaved draft.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
