<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useClients } from '../composables/useClients'
import { useInvoices } from '../composables/useInvoices'
import { byIssueDate, summariseClients } from '../utils/summary'
import { computeTotals, effectiveStatus } from '../utils/invoice'
import { formatMoney } from '../utils/money'
import { EMPTY_MARKER, orDash } from '../utils/display'
import type { CurrencyAmount } from '../utils/summary'
import type { Client, Invoice } from '../types'

const route = useRoute()
const { clients, load: loadClients, save } = useClients()
const { invoices, load: loadInvoices } = useInvoices()

const ready = ref(false)
const now = new Date()

onMounted(async () => {
  await Promise.all([loadClients(), loadInvoices()])
  ready.value = true
})

const client = computed<Client | undefined>(() =>
  clients.value.find((entry) => entry.id === route.params.id),
)

const summary = computed(() =>
  client.value ? summariseClients([client.value], invoices.value, now)[0] : undefined,
)

const theirs = computed(() =>
  client.value
    ? byIssueDate(invoices.value.filter((invoice) => invoice.clientId === client.value!.id))
    : [],
)

function statusOf(invoice: Invoice) {
  return effectiveStatus(invoice, now)
}

function totalOf(invoice: Invoice) {
  return formatMoney(computeTotals(invoice).total, invoice.currency)
}

const editing = ref(false)
const draft = ref<Client | null>(null)
const busy = ref(false)

function startEdit() {
  if (!client.value) return
  draft.value = { ...client.value }
  editing.value = true
}

/**
 * Saves the record only. Invoices already raised keep the address block they
 * were issued with — that is the audit record — and resolve through the id,
 * which never changes.
 */
async function onSave() {
  if (!draft.value || !draft.value.name.trim()) return
  busy.value = true
  try {
    await save({ ...draft.value, name: draft.value.name.trim() })
    editing.value = false
  } finally {
    busy.value = false
  }
}

function amounts(entries: CurrencyAmount[]): string {
  if (entries.length === 0) return EMPTY_MARKER
  return entries.map((entry) => formatMoney(entry.amount, entry.currency)).join('  ·  ')
}
</script>

<template>
  <p v-if="!ready" class="text-muted">Loading…</p>

  <div v-else-if="!client" class="text-muted">
    <p>That client no longer exists.</p>
    <RouterLink to="/clients">Back to clients</RouterLink>
  </div>

  <div v-else class="client">
    <nav aria-label="Breadcrumb">
      <RouterLink to="/clients" class="text-muted">← Clients</RouterLink>
    </nav>

    <header class="client__head">
      <div>
        <h1>{{ client.name }}</h1>
        <p v-if="summary" class="text-muted">
          {{ summary.invoiceCount }} invoice{{ summary.invoiceCount === 1 ? '' : 's' }} ·
          {{ amounts(summary.outstanding) }} outstanding
        </p>
      </div>
      <button v-if="!editing" type="button" class="btn btn-secondary" @click="startEdit">
        Edit details
      </button>
    </header>

    <form v-if="editing && draft" class="client__edit" @submit.prevent="onSave">
      <p class="text-muted client__note">
        Changes apply from here on. Invoices already raised keep the details they were
        issued with.
      </p>

      <div class="field">
        <label for="edit-name">Name</label>
        <input id="edit-name" v-model="draft.name" class="input" required />
      </div>

      <div class="field">
        <label for="edit-billTo">Billing address</label>
        <textarea id="edit-billTo" v-model="draft.billTo" class="input" rows="4" />
      </div>

      <div class="field">
        <label for="edit-shipTo">Shipping address</label>
        <textarea id="edit-shipTo" v-model="draft.shipTo" class="input" rows="3" />
      </div>

      <div class="field">
        <label for="edit-vatId">VAT / tax id</label>
        <input id="edit-vatId" v-model="draft.vatId" class="input" />
      </div>

      <div class="client__actions">
        <button type="submit" class="btn btn-primary" :disabled="busy || !draft.name.trim()">
          Save
        </button>
        <button type="button" class="btn btn-secondary" @click="editing = false">Cancel</button>
      </div>
    </form>

    <section v-else class="client__details">
      <div>
        <h2 class="label">Billing address</h2>
        <p class="block">{{ orDash(client.billTo) }}</p>
      </div>
      <div v-if="client.shipTo">
        <h2 class="label">Shipping address</h2>
        <p class="block">{{ client.shipTo }}</p>
      </div>
      <div v-if="client.vatId">
        <h2 class="label">VAT / tax id</h2>
        <p class="block">{{ client.vatId }}</p>
      </div>
    </section>

    <section>
      <h2 class="label">Invoices</h2>

      <p v-if="theirs.length === 0" class="text-muted">Nothing raised for this client yet.</p>

      <table v-else class="table table-stack">
        <caption class="sr-only">Invoices for {{ client.name }}, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Number</th>
            <th scope="col">Issued</th>
            <th scope="col" class="numeric">Total</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="invoice in theirs" :key="invoice.id">
            <td data-label="Number">
              <RouterLink :to="`/invoices/${invoice.id}`" class="amt">
                {{ invoice.number || 'Draft' }}
              </RouterLink>
            </td>
            <td data-label="Issued" class="amt">{{ orDash(invoice.issuedOn) }}</td>
            <td data-label="Total" class="numeric amt">{{ totalOf(invoice) }}</td>
            <td data-label="Status">
              <span class="tag" :class="`tag--${statusOf(invoice)}`">{{ statusOf(invoice) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.client {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.client__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.client__head .btn {
  min-height: 44px;
}

.client__edit {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.client__edit .input {
  width: 100%;
}

.client__note {
  margin: 0;
}

.client__actions {
  display: flex;
  gap: var(--space-2);
}

.client__actions .btn {
  min-height: 44px;
}

.client__head h1 {
  font-size: 30px;
}

.client__head p {
  margin: var(--space-1) 0 0;
}

.client__details {
  display: grid;
  gap: var(--space-4);
}

.label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-accent-text);
  margin-bottom: var(--space-2);
}

/* Addresses are entered as free text and must keep their line breaks. */
.block {
  margin: 0;
  white-space: pre-wrap;
}

@media (min-width: 40rem) {
  .client__details {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }

}
</style>
