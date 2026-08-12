<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CURRENCY_CODES, DEFAULT_CURRENCY } from '../config/currency'
import { useSenders } from '../composables/useSenders'
import { currencyName } from '../utils/money'
import type { CurrencyCode, Sender } from '../types'

/**
 * Namespace setup — the first thing that happens, and the reason `Sender.from`
 * can be non-empty by construction (spec §5.2).
 */

const router = useRouter()
const { save } = useSenders()

const name = ref('')
const from = ref('')
const vatId = ref('')
const currency = ref<CurrencyCode>(DEFAULT_CURRENCY)
const numberPrefix = ref('INV-')
// Shown and editable rather than buried in code — the user owns this number.
const paymentTermDays = ref(14)
const busy = ref(false)

// Exactly what an invoice cannot be issued without.
const complete = computed(() => name.value.trim() !== '' && from.value.trim() !== '')

async function onSubmit() {
  if (!complete.value || busy.value) return
  busy.value = true

  try {
    const sender: Sender = {
      id: crypto.randomUUID(),
      name: name.value.trim(),
      from: from.value.trim(),
      logo: null,
      vatId: vatId.value.trim(),
      numberPrefix: numberPrefix.value.trim(),
      paymentTermDays: Math.max(0, Math.round(paymentTermDays.value)),
      notes: '',
      terms: '',
      taxRate: 0,
      currency: currency.value,
      isDefault: true,
      archived: false,
    }

    await save(sender)
    await router.replace('/invoices')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="setup">
    <header>
      <h1>Who are you invoicing as?</h1>
      <p class="text-muted">
        This appears on every invoice you issue. You can change it later, and add other
        businesses if you invoice as more than one.
      </p>
    </header>

    <form class="setup__form blueprint" @submit.prevent="onSubmit">
      <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i class="corner br" />

      <div class="field">
        <label for="name">Business name</label>
        <input
          id="name"
          v-model="name"
          class="input"
          required
          autocomplete="organization"
          placeholder="Sundial Studio"
        />
      </div>

      <div class="field">
        <label for="from">Address</label>
        <textarea
          id="from"
          v-model="from"
          class="input"
          rows="4"
          required
          autocomplete="street-address"
          placeholder="12 Bridge Street&#10;Bristol BS1 4AA&#10;hello@sundial.studio"
        />
      </div>

      <div class="field">
        <label for="vatId">VAT / tax id <span class="text-muted">(optional)</span></label>
        <input id="vatId" v-model="vatId" class="input" placeholder="GB123456789" />
      </div>

      <div class="setup__pair">
        <div class="field">
          <label for="currency">Default currency</label>
          <select id="currency" v-model="currency" class="input">
            <option v-for="code in CURRENCY_CODES" :key="code" :value="code">
              {{ code }} — {{ currencyName(code) }}
            </option>
          </select>
        </div>

        <div class="field">
          <label for="prefix">Invoice number prefix</label>
          <input id="prefix" v-model="numberPrefix" class="input amt" />
        </div>

        <div class="field">
          <label for="terms">Payment terms (days)</label>
          <input
            id="terms"
            v-model.number="paymentTermDays"
            class="input amt"
            type="number"
            min="0"
            step="1"
          />
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="!complete || busy">
        Start invoicing
      </button>
    </form>
  </div>
</template>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 34rem;
  margin: 0 auto;
}

.setup h1 {
  font-size: 28px;
}

.setup header p {
  margin: var(--space-2) 0 0;
}

.setup__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
}

.setup__form .input {
  width: 100%;
}

.setup__pair {
  display: grid;
  gap: var(--space-4);
}

.btn-block {
  min-height: 44px;
}

@media (min-width: 40rem) {
  .setup__pair {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
