import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import router from './router'
import { initPwa } from './composables/usePwa'

/**
 * The worker is registered before mount so an update is known about early, but
 * it is never applied automatically — reloading mid-invoice would lose an
 * unsaved draft. `initPwa` hands the apply function to the UI instead.
 */
initPwa((onReady) => {
  const updateSW = registerSW({
    onNeedRefresh: () => onReady(() => void updateSW(true)),
  })
})

createApp(App).use(router).mount('#app')
