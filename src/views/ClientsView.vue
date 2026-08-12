<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useClients } from '../composables/useClients'
import { useInvoices } from '../composables/useInvoices'
import { summariseClients } from '../utils/summary'
import { formatMoney } from '../utils/money'
import { EMPTY_MARKER, orDash } from '../utils/display'
import type { CurrencyAmount } from '../utils/summary'

const { clients, load: loadClients } = useClients()
const { invoices, load: loadInvoices } = useInvoices()

const ready = ref(false)
const now = new Date()

onMounted(async () => {
  await Promise.all([loadClients(), loadInvoices()])
  ready.value = true
})

const rows = computed(() => summariseClients(clients.value, invoices.value, now))

function amounts(entries: CurrencyAmount[]): string {
  if (entries.length === 0) return EMPTY_MARKER
  return entries.map((entry) => formatMoney(entry.amount, entry.currency)).join('  ·  ')
}
</script>

<template>
  <div class="clients">
    <header class="clients__head">
      <h1>Clients</h1>
      <p class="text-muted">Built from the invoices you raise — there is nothing to add by hand.</p>
    </header>

    <p v-if="!ready" class="text-muted">Loading…</p>

    <p v-else-if="rows.length === 0" class="text-muted empty">
      No clients yet.
      <RouterLink to="/invoices/new">Raise an invoice</RouterLink>
      and whoever it is addressed to appears here.
    </p>

    <table v-else class="table table-stack">
      <caption class="sr-only">Clients, most recently invoiced first</caption>
      <thead>
        <tr>
          <th scope="col">Client</th>
          <th scope="col" class="numeric">Invoices</th>
          <th scope="col">Last invoiced</th>
          <th scope="col" class="numeric">Outstanding</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.client.id">
          <td data-label="Client">
            <RouterLink :to="`/clients/${row.client.id}`">{{ row.client.name }}</RouterLink>
          </td>
          <td data-label="Invoices" class="numeric amt">{{ row.invoiceCount }}</td>
          <td data-label="Last invoiced" class="amt">{{ orDash(row.lastInvoiced) }}</td>
          <td data-label="Outstanding" class="numeric amt">{{ amounts(row.outstanding) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.clients {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.clients__head h1 {
  font-size: 30px;
}

.clients__head p {
  margin: var(--space-1) 0 0;
}

.empty {
  padding: var(--space-8) 0;
}

</style>
