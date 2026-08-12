<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useInvoices } from '../composables/useInvoices'
import { useClients } from '../composables/useClients'
import { computeTotals, effectiveStatus } from '../utils/invoice'
import { summarise, filterByStatus, byIssueDate } from '../utils/summary'
import { formatMoney } from '../utils/money'
import { EMPTY_MARKER, orDash } from '../utils/display'
import { EffectiveStatus, InvoiceStatus } from '../types'
import type { CurrencyAmount } from '../utils/summary'
import type { Invoice } from '../types'

const { invoices, load } = useInvoices()
const { load: loadClients, nameFor } = useClients()

const filter = ref<EffectiveStatus | 'all'>('all')
const ready = ref(false)
const now = new Date()

onMounted(async () => {
  await Promise.all([load(), loadClients()])
  ready.value = true
})

const summary = computed(() => summarise(invoices.value, now))

const rows = computed(() => byIssueDate(filterByStatus(invoices.value, filter.value, now)))

const filters = computed(() => [
  { key: 'all' as const, label: 'All' },
  { key: EffectiveStatus.Overdue, label: 'Overdue' },
  { key: InvoiceStatus.Sent, label: 'Sent' },
  { key: InvoiceStatus.Draft, label: 'Draft' },
  { key: InvoiceStatus.Paid, label: 'Paid' },
  { key: InvoiceStatus.Void, label: 'Void' },
])

function statusOf(invoice: Invoice) {
  return effectiveStatus(invoice, now)
}

function balanceOf(invoice: Invoice) {
  return formatMoney(computeTotals(invoice).balanceDue, invoice.currency)
}

function totalOf(invoice: Invoice) {
  return formatMoney(computeTotals(invoice).total, invoice.currency)
}

/** Each currency stands alone: there are no rates here to combine them with. */
function amounts(entries: CurrencyAmount[]): string {
  if (entries.length === 0) return EMPTY_MARKER
  return entries.map((entry) => formatMoney(entry.amount, entry.currency)).join('  ·  ')
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__head">
      <h1>Invoices</h1>
      <RouterLink class="btn btn-primary blueprint" to="/invoices/new">
        <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i class="corner br" />
        New invoice
      </RouterLink>
    </header>

    <section class="tiles" aria-label="Summary">
      <article class="tile blueprint">
        <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i class="corner br" />
        <h2 class="tile__label">Outstanding</h2>
        <p class="tile__value amt">{{ amounts(summary.outstanding) }}</p>
        <p class="tile__note text-muted">
          {{ summary.counts.sent + summary.counts.overdue }} awaiting payment
        </p>
      </article>

      <article class="tile blueprint">
        <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i class="corner br" />
        <h2 class="tile__label">Overdue</h2>
        <p class="tile__value amt">{{ amounts(summary.overdue) }}</p>
        <p class="tile__note text-muted">{{ summary.counts.overdue }} past due</p>
      </article>

      <article class="tile blueprint">
        <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i class="corner br" />
        <h2 class="tile__label">Paid, last 30 days</h2>
        <p class="tile__value amt">{{ amounts(summary.paidRecently) }}</p>
        <p class="tile__note text-muted">{{ summary.counts.paid }} settled overall</p>
      </article>

      <article class="tile blueprint">
        <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i class="corner br" />
        <h2 class="tile__label">Average days to pay</h2>
        <p class="tile__value amt">{{ orDash(summary.averageDaysToPay) }}</p>
        <p class="tile__note text-muted">From issue to payment</p>
      </article>
    </section>

    <nav class="filters" aria-label="Filter by status">
      <button
        v-for="entry in filters"
        :key="entry.key"
        type="button"
        class="filters__tab"
        :class="{ 'filters__tab--on': filter === entry.key }"
        :aria-pressed="filter === entry.key"
        @click="filter = entry.key"
      >
        {{ entry.label }}
        <span class="filters__count">{{ summary.counts[entry.key] }}</span>
      </button>
    </nav>

    <p v-if="!ready" class="text-muted">Loading…</p>

    <p v-else-if="rows.length === 0" class="text-muted empty">
      Nothing here yet.
      <RouterLink to="/invoices/new">Create the first invoice.</RouterLink>
    </p>

    <table v-else class="table table-stack">
      <caption class="sr-only">Invoices, newest first</caption>
      <thead>
        <tr>
          <th scope="col">Number</th>
          <th scope="col">Client</th>
          <th scope="col">Issued</th>
          <th scope="col">Due</th>
          <th scope="col" class="numeric">Total</th>
          <th scope="col" class="numeric">Balance</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="invoice in rows" :key="invoice.id">
          <td data-label="Number">
            <RouterLink :to="`/invoices/${invoice.id}`" class="amt">
              {{ invoice.number || 'Draft' }}
            </RouterLink>
          </td>
          <td data-label="Client">{{ nameFor(invoice.clientId) }}</td>
          <td data-label="Issued" class="amt">{{ orDash(invoice.issuedOn) }}</td>
          <td data-label="Due" class="amt">{{ orDash(invoice.dueOn) }}</td>
          <td data-label="Total" class="numeric amt">{{ totalOf(invoice) }}</td>
          <td data-label="Balance" class="numeric amt">{{ balanceOf(invoice) }}</td>
          <td data-label="Status">
            <span class="tag" :class="`tag--${statusOf(invoice)}`">{{ statusOf(invoice) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Mobile first. The table becomes a stacked list below the tablet breakpoint —
   seven columns cannot survive a narrow screen — and returns to a real table
   once there is room. The markup stays a table throughout, so the semantics do
   not change with the layout. */

.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.dashboard__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.dashboard__head h1 {
  font-size: 30px;
}

.dashboard__head .btn {
  min-height: 44px;
}

.tiles {
  display: grid;
  gap: var(--space-4);
}

.tile {
  padding: var(--space-4);
}

.tile__label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-accent-text);
  margin-bottom: var(--space-2);
}

.tile__value {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: 24px;
  margin: 0;
  /* Several currencies can share a tile, and they must not overflow it. */
  overflow-wrap: anywhere;
}

.tile__note {
  margin: var(--space-1) 0 0;
  font-size: 13px;
}

.filters {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  scrollbar-width: none;
}

.filters::-webkit-scrollbar {
  display: none;
}

.filters__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 var(--space-3);
  white-space: nowrap;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--color-divider);
  cursor: pointer;
}

.filters__tab:hover {
  background: color-mix(in srgb, var(--color-text) 6%, transparent);
}

.filters__tab--on {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg);
}

.filters__count {
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

.empty {
  padding: var(--space-8) 0;
}

@media (min-width: 40rem) {
  .tiles {
    grid-template-columns: repeat(2, 1fr);
  }

}

@media (min-width: 64rem) {
  .tiles {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
