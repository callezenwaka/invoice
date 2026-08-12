import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSenders } from '../composables/useSenders'

// Navigation is Invoices and Clients only — no Payments, no Reports (spec §5.1).
// Views are lazy-loaded so the builder's pdfmake chunk stays out of the first paint.
const routes: RouteRecordRaw[] = [
  {
    path: '/setup',
    name: 'setup',
    component: () => import('../views/SetupView.vue'),
    meta: { public: true },
  },
  { path: '/', redirect: '/invoices' },
  {
    path: '/invoices',
    name: 'invoices',
    component: () => import('../views/InvoicesView.vue'),
  },
  {
    path: '/invoices/new',
    name: 'invoice-new',
    component: () => import('../views/InvoiceView.vue'),
  },
  {
    // Drafts open editable; sent/paid/void open read-only (spec §2.3).
    path: '/invoices/:id',
    name: 'invoice',
    component: () => import('../views/InvoiceView.vue'),
  },
  {
    path: '/clients',
    name: 'clients',
    component: () => import('../views/ClientsView.vue'),
  },
  {
    path: '/clients/:id',
    name: 'client',
    component: () => import('../views/ClientView.vue'),
  },
  { path: '/:pathMatch(.*)*', redirect: '/invoices' },
]

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable before a sender exists. Only setup is. */
    public?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * Nothing is reachable until a business exists (spec §5.2).
 *
 * This guard is what lets `Sender.from` be non-empty by construction: without
 * it the app would have to invent a blank sender, and every invoice would
 * snapshot an empty address.
 */
router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const { load } = useSenders()
  const senders = await load()
  const ready = senders.some((sender) => !sender.archived)

  return ready ? true : { name: 'setup' }
})

export default router
