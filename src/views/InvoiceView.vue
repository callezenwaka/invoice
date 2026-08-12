<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CURRENCY_CODES } from '../config/currency'
import { useInvoices } from '../composables/useInvoices'
import { useSenders } from '../composables/useSenders'
import { useClients } from '../composables/useClients'
import { computeTotals, isEditable, issueBlockers, newInvoice, newLineItem } from '../utils/invoice'
import { currencyName, formatMoney, toMajor, toMinor } from '../utils/money'
import { parseLine } from '../utils/parseLine'
import { orDash } from '../utils/display'
import { download, pdfFilename, toDataUrl } from '../utils/pdf'
import { invoiceDocument } from '../utils/invoiceDocument'
import AppIcon from '../components/AppIcon.vue'
import { TaxMode } from '../types'
import type { Invoice, LineItem, Sender } from '../types'

const route = useRoute()
const router = useRouter()

const { find, save, issue } = useInvoices()
const { active: activeSenders, defaultSender, load: loadSenders, save: saveSender } = useSenders()
const { load: loadClients, suggest, resolveFor } = useClients()

const invoice = ref<Invoice | null>(null)
const sender = ref<Sender | null>(null)
const senders = ref<Sender[]>([])
const command = ref('')
const previewUrl = ref('')
const busy = ref(false)
const status = ref('')
const invalidAmounts = ref(new Set<string>())

// Optional rows appear once used, and stay for the session once shown.
const showDiscount = ref(false)
const showShipping = ref(false)

const editable = computed(() => (invoice.value ? isEditable(invoice.value.status) : false))
const totals = computed(() => (invoice.value ? computeTotals(invoice.value) : null))
const blockers = computed(() => (invoice.value ? issueBlockers(invoice.value) : []))

const parsed = computed(() =>
  invoice.value && command.value.trim() ? parseLine(command.value, invoice.value.currency) : null,
)
const clientMatches = computed(() =>
  editable.value && invoice.value ? suggest(firstLine(invoice.value.billTo)) : [],
)

onMounted(async () => {
  await Promise.all([loadSenders(), loadClients()])
  senders.value = activeSenders()

  const id = route.params.id as string | undefined

  if (id) {
    const found = await find(id)
    if (!found) return router.replace('/invoices')
    invoice.value = found
    sender.value = senders.value.find((entry) => entry.id === found.senderId) ?? null
  } else {
    const seed = await defaultSender()
    if (!seed) return router.replace('/setup')
    sender.value = seed
    invoice.value = newInvoice(seed)
  }

  showDiscount.value = (invoice.value?.discount ?? 0) > 0
  showShipping.value = (invoice.value?.shipping ?? 0) > 0
})

function major(minor: number): string {
  if (!invoice.value) return ''
  return minor === 0 ? '' : String(toMajor(minor, invoice.value.currency))
}

function money(minor: number): string {
  return invoice.value ? formatMoney(minor, invoice.value.currency) : ''
}

function firstLine(value: string): string {
  return value.split('\n')[0]?.trim() ?? ''
}

/**
 * Amount entry.
 *
 * An unreadable value leaves the model untouched and marks the field, because
 * writing zero would be indistinguishable from an amount deliberately set to
 * zero. Clearing the field is a real zero — an absent discount is no discount.
 */
function setAmount(raw: string, apply: (minor: number) => void, key: string) {
  if (!invoice.value) return

  const minor = raw.trim() === '' ? 0 : toMinor(raw, invoice.value.currency)
  const invalid = new Set(invalidAmounts.value)

  if (minor === null) invalid.add(key)
  else {
    invalid.delete(key)
    apply(minor)
  }

  invalidAmounts.value = invalid
}

function addItem() {
  invoice.value?.items.push(newLineItem())
}

function removeItem(id: string) {
  if (!invoice.value) return
  invoice.value.items = invoice.value.items.filter((item) => item.id !== id)
  if (invoice.value.items.length === 0) addItem()
}

function commitCommand() {
  if (!invoice.value || !parsed.value) return

  invoice.value.items.push({ id: crypto.randomUUID(), ...parsed.value })
  command.value = ''

  // The blank row the builder starts with is scaffolding, not data.
  const [first] = invoice.value.items
  if (invoice.value.items.length > 1 && !first.description && first.rate === 0) {
    invoice.value.items = invoice.value.items.slice(1)
  }
}

function applyClient(billTo: string, shipTo: string) {
  if (!invoice.value) return
  invoice.value.billTo = billTo
  if (shipTo) invoice.value.shipTo = shipTo
}

/** The mark belongs to the sender and is read live, so uploading updates it. */
async function onLogo(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !sender.value) return

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  sender.value = { ...sender.value, logo: dataUrl }
  await saveSender(sender.value)
}

async function linkClient(current: Invoice): Promise<Invoice> {
  const client = await resolveFor(current)
  return client ? { ...current, clientId: client.id } : current
}

async function onSave() {
  if (!invoice.value) return
  busy.value = true
  try {
    invoice.value = await save(await linkClient(invoice.value))
    status.value = 'Saved'
  } finally {
    busy.value = false
  }
}

async function onIssue() {
  if (!invoice.value || !sender.value) return

  if (invalidAmounts.value.size > 0) {
    status.value = 'Fix the highlighted amounts first'
    return
  }
  if (blockers.value.length > 0) {
    status.value = 'Not ready to issue'
    return
  }

  busy.value = true
  try {
    const saved = await save(await linkClient(invoice.value))
    invoice.value = await issue(saved, sender.value)
    status.value = `Issued as ${invoice.value.number}`
  } finally {
    busy.value = false
  }
}

function documentFor(current: Invoice, from: Sender) {
  return invoiceDocument({ invoice: current, sender: from, logo: from.logo })
}

async function onPreview() {
  if (!invoice.value || !sender.value) return
  busy.value = true
  try {
    previewUrl.value = await toDataUrl(documentFor(invoice.value, sender.value))
  } finally {
    busy.value = false
  }
}

async function onDownload() {
  if (!invoice.value || !sender.value) return
  busy.value = true
  try {
    await download(documentFor(invoice.value, sender.value), pdfFilename(invoice.value.number))
  } finally {
    busy.value = false
  }
}

async function onReplace() {
  if (!sender.value) return
  invoice.value = newInvoice(sender.value)
  await router.replace('/invoices/new')
}

function lineAmountOf(item: LineItem): number {
  return Math.round(item.quantity * item.rate)
}

const drafted = computed(() =>
  Boolean(invoice.value?.items.some((item) => item.description || item.rate)),
)

watch(status, (value) => {
  if (value) setTimeout(() => (status.value = ''), 2500)
})
</script>

<template>
  <div v-if="invoice && sender" class="builder">
    <header class="builder__bar">
      <div>
        <h1 class="sr-only">{{ invoice.number || 'New invoice' }}</h1>
        <p class="builder__state text-muted">
          {{ editable ? 'Draft — editable' : `${invoice.status} — read only` }}
        </p>
      </div>

      <div class="builder__actions">
        <template v-if="editable">
          <button class="btn btn-secondary" :disabled="busy" @click="onSave">Save</button>
          <button
            class="btn btn-primary blueprint"
            :disabled="busy || blockers.length > 0"
            @click="onIssue"
          >
            <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i
              class="corner br"
            />
            <AppIcon name="send" :size="16" />
            Issue
          </button>
        </template>
        <button v-else class="btn btn-secondary" @click="onReplace">Replace this invoice</button>

        <button class="btn btn-secondary" :disabled="busy" @click="onPreview">
          <AppIcon name="eye" :size="16" />
          Preview
        </button>
        <button
          class="btn btn-secondary"
          :disabled="busy || !invoice.number"
          :title="invoice.number ? undefined : 'Issue the invoice to download it'"
          @click="onDownload"
        >
          <AppIcon name="download" :size="16" />
          Download
        </button>
      </div>
    </header>

    <p v-if="status" class="builder__status" role="status" aria-live="polite">{{ status }}</p>

    <ul v-if="editable && blockers.length" class="blockers" aria-label="Before this can be issued">
      <li v-for="blocker in blockers" :key="blocker.field">{{ blocker.message }}</li>
    </ul>

    <div v-if="senders.length > 1 && editable" class="field">
      <label for="sender">Issuing as</label>
      <select id="sender" v-model="invoice.senderId" class="input">
        <option v-for="entry in senders" :key="entry.id" :value="entry.id">{{ entry.name }}</option>
      </select>
    </div>

    <article class="sheet blueprint">
      <i class="corner tl" /><i class="corner tr" /><i class="corner bl" /><i class="corner br" />

      <div class="sheet__masthead">
        <label class="mark" :class="{ 'mark--set': sender.logo }">
          <input type="file" accept="image/*" :disabled="!editable" @change="onLogo" />
          <img v-if="sender.logo" :src="sender.logo" alt="" />
          <span v-else>Drop your mark<br /><small>or browse files</small></span>
        </label>

        <div>
          <h2 id="issued-by" class="label">Issued by</h2>
          <textarea
            v-model="invoice.from"
            class="ghost ghost--block"
            rows="4"
            :readonly="!editable"
            placeholder="Your business&#10;Street, city&#10;you@business.com"
            aria-labelledby="issued-by"
          />
        </div>

        <div class="sheet__title">
          <p class="sheet__word">INVOICE</p>
          <p class="sheet__rev text-muted">{{ orDash(invoice.number) }}</p>
        </div>
      </div>

      <hr class="rule" />

      <div class="sheet__parties">
        <div>
          <h2 id="billed-to" class="label">Billed to</h2>
          <textarea
            v-model="invoice.billTo"
            class="ghost ghost--block"
            rows="4"
            :readonly="!editable"
            placeholder="Client name&#10;Billing address&#10;VAT / tax id"
            aria-labelledby="billed-to"
          />
          <ul v-if="clientMatches.length" class="suggestions" aria-label="Matching clients">
            <li v-for="match in clientMatches" :key="match.id">
              <button
                type="button"
                class="btn btn-ghost"
                @click="applyClient(match.billTo, match.shipTo)"
              >
                {{ match.name }}
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h2 id="shipped-to" class="label">Shipped to</h2>
          <textarea
            v-model="invoice.shipTo"
            class="ghost ghost--block"
            rows="4"
            :readonly="!editable"
            placeholder="Optional"
            aria-labelledby="shipped-to"
          />
        </div>

        <div>
          <h2 class="label">Reference</h2>
          <div class="reference__row">
            <label for="terms-field" class="text-muted">Terms</label>
            <input
              id="terms-field"
              v-model="invoice.terms"
              class="ghost"
              :readonly="!editable"
              placeholder="Net 21"
            />
          </div>
          <div class="reference__row">
            <label for="po" class="text-muted">PO no.</label>
            <input
              id="po"
              v-model="invoice.poNumber"
              class="ghost"
              :readonly="!editable"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      <section class="items">
        <div class="items__head">
          <h2 class="label">Bill of items</h2>
          <span v-if="!drafted" class="text-muted">Nothing drafted yet</span>
        </div>

        <table class="table table-stack">
          <caption class="sr-only">
            Line items
          </caption>
          <thead>
            <tr>
              <th scope="col" class="items__no">No.</th>
              <th scope="col">Description</th>
              <th scope="col" class="numeric items__qty">Qty</th>
              <th scope="col" class="numeric items__rate">Rate</th>
              <th scope="col" class="numeric items__amount">Amount</th>
              <th v-if="editable"><span class="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in invoice.items" :key="item.id">
              <td data-label="No." class="items__no amt">{{ index + 1 }}</td>
              <td data-label="Description">
                <input
                  v-model="item.description"
                  class="ghost"
                  :readonly="!editable"
                  placeholder="Description of item or service"
                  aria-label="Description"
                />
              </td>
              <td data-label="Qty" class="numeric items__qty">
                <input
                  v-model.number="item.quantity"
                  class="ghost numeric"
                  type="number"
                  min="0"
                  step="any"
                  :readonly="!editable"
                  aria-label="Quantity"
                />
              </td>
              <td data-label="Rate" class="numeric items__rate">
                <input
                  class="ghost numeric"
                  type="number"
                  min="0"
                  step="any"
                  :value="major(item.rate)"
                  :readonly="!editable"
                  :aria-invalid="invalidAmounts.has(item.id)"
                  aria-label="Rate"
                  @input="
                    setAmount(($event.target as HTMLInputElement).value, (m) => (item.rate = m), item.id)
                  "
                />
                <p v-if="invalidAmounts.has(item.id)" class="field-error">Needs a number</p>
              </td>
              <td data-label="Amount" class="numeric amt items__amount">{{ money(lineAmountOf(item)) }}</td>
              <td v-if="editable" class="items__remove">
                <button
                  type="button"
                  class="btn btn-ghost"
                  :aria-label="`Remove ${item.description || 'line item'}`"
                  @click="removeItem(item.id)"
                >
                  <AppIcon name="x" :size="16" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="editable" class="items__entry">
          <button type="button" class="btn btn-secondary" @click="addItem">Add line</button>

          <div class="items__command">
            <label class="sr-only" for="command">Quick entry</label>
            <input
              id="command"
              v-model="command"
              class="ghost"
              placeholder="12h discovery @ 140 — then Enter"
              @keydown.enter.prevent="commitCommand"
            />
            <p v-if="parsed" class="text-muted items__hint">
              {{ parsed.quantity }} × {{ money(parsed.rate)
              }}{{ parsed.description ? ` — ${parsed.description}` : '' }}
            </p>
          </div>
        </div>
      </section>

      <div class="sheet__foot">
        <div>
          <h2 id="notes-label" class="label">Notes</h2>
          <textarea
            v-model="invoice.notes"
            class="ghost ghost--block"
            rows="4"
            :readonly="!editable"
            placeholder="Payment details, or anything not already covered above"
            aria-labelledby="notes-label"
          />
        </div>

        <dl v-if="totals" class="totals">
          <div>
            <dt>Subtotal</dt>
            <dd class="amt">{{ money(totals.subtotal) }}</dd>
          </div>

          <div v-if="showDiscount">
            <dt><label for="discount">Discount</label></dt>
            <dd>
              <input
                id="discount"
                class="ghost numeric totals__amount"
                type="number"
                min="0"
                step="any"
                :value="major(invoice.discount)"
                :readonly="!editable"
                :aria-invalid="invalidAmounts.has('discount')"
                @input="
                  setAmount(
                    ($event.target as HTMLInputElement).value,
                    (m) => (invoice!.discount = m),
                    'discount',
                  )
                "
              />
            </dd>
          </div>

          <div>
            <dt class="totals__tax">
              <label for="tax">Tax</label>
              <input
                v-if="invoice.taxMode === TaxMode.Percentage"
                id="tax"
                v-model.number="invoice.taxRate"
                class="ghost numeric totals__rate"
                type="number"
                min="0"
                step="any"
                :readonly="!editable"
              />
              <input
                v-else
                id="tax"
                class="ghost numeric totals__rate"
                type="number"
                min="0"
                step="any"
                :value="major(invoice.taxRate)"
                :readonly="!editable"
                @input="
                  setAmount(
                    ($event.target as HTMLInputElement).value,
                    (m) => (invoice!.taxRate = m),
                    'tax',
                  )
                "
              />
              <!-- The field means a percentage or a flat amount, so the choice
                   has to sit beside it rather than be inferred. -->
              <span class="seg">
                <button
                  type="button"
                  class="seg-opt"
                  :class="{ 'seg-opt--on': invoice.taxMode === TaxMode.Percentage }"
                  :aria-pressed="invoice.taxMode === TaxMode.Percentage"
                  :disabled="!editable"
                  @click="invoice.taxMode = TaxMode.Percentage"
                >
                  %
                </button>
                <button
                  type="button"
                  class="seg-opt"
                  :class="{ 'seg-opt--on': invoice.taxMode === TaxMode.Fixed }"
                  :aria-pressed="invoice.taxMode === TaxMode.Fixed"
                  :disabled="!editable"
                  @click="invoice.taxMode = TaxMode.Fixed"
                >
                  {{ invoice.currency }}
                </button>
              </span>
            </dt>
            <dd class="amt">{{ money(totals.tax) }}</dd>
          </div>

          <div v-if="showShipping">
            <dt><label for="shipping">Shipping</label></dt>
            <dd>
              <input
                id="shipping"
                class="ghost numeric totals__amount"
                type="number"
                min="0"
                step="any"
                :value="major(invoice.shipping)"
                :readonly="!editable"
                :aria-invalid="invalidAmounts.has('shipping')"
                @input="
                  setAmount(
                    ($event.target as HTMLInputElement).value,
                    (m) => (invoice!.shipping = m),
                    'shipping',
                  )
                "
              />
            </dd>
          </div>

          <div v-if="editable && (!showDiscount || !showShipping)" class="totals__add">
            <button
              v-if="!showDiscount"
              type="button"
              class="btn btn-ghost"
              @click="showDiscount = true"
            >
              <AppIcon name="plus" :size="14" />
              Discount
            </button>
            <button
              v-if="!showShipping"
              type="button"
              class="btn btn-ghost"
              @click="showShipping = true"
            >
              <AppIcon name="plus" :size="14" />
              Shipping
            </button>
          </div>

          <div class="totals__total">
            <dt>Total</dt>
            <dd class="amt">{{ money(totals.total) }}</dd>
          </div>

          <div>
            <dt><label for="paid">Amount paid</label></dt>
            <dd>
              <input
                id="paid"
                class="ghost numeric totals__amount"
                type="number"
                min="0"
                step="any"
                :value="major(invoice.amountPaid)"
                :readonly="!editable"
                :aria-invalid="invalidAmounts.has('paid')"
                @input="
                  setAmount(
                    ($event.target as HTMLInputElement).value,
                    (m) => (invoice!.amountPaid = m),
                    'paid',
                  )
                "
              />
            </dd>
          </div>

          <div class="balance">
            <dt class="label balance__label">Balance due</dt>
            <dd class="amt balance__value">{{ money(totals.balanceDue) }}</dd>
          </div>
        </dl>
      </div>

      <div class="meta">
        <div class="meta__cell">
          <span class="meta__label">Invoice no.</span>
          <span class="amt">{{ orDash(invoice.number) }}</span>
        </div>
        <div class="meta__cell">
          <label class="meta__label" for="issuedOn">Issued</label>
          <input
            id="issuedOn"
            v-model="invoice.issuedOn"
            class="ghost"
            type="date"
            :readonly="!editable"
          />
        </div>
        <div class="meta__cell">
          <label class="meta__label" for="dueOn">Due</label>
          <input id="dueOn" v-model="invoice.dueOn" class="ghost" type="date" :readonly="!editable" />
        </div>
        <div class="meta__cell">
          <label class="meta__label" for="currency">Currency</label>
          <select id="currency" v-model="invoice.currency" class="ghost" :disabled="!editable">
            <option v-for="code in CURRENCY_CODES" :key="code" :value="code">
              {{ code }} — {{ currencyName(code) }}
            </option>
          </select>
        </div>
        <div class="meta__cell">
          <span class="meta__label">State</span>
          <span>{{ invoice.status }}</span>
        </div>
      </div>
    </article>

    <div v-if="previewUrl" class="preview" role="dialog" aria-label="Invoice preview">
      <div class="preview__bar">
        <button class="btn btn-secondary" @click="previewUrl = ''">Close preview</button>
      </div>
      <iframe :src="previewUrl" title="Invoice preview" class="preview__frame" />
    </div>
  </div>

  <p v-else class="text-muted">Loading…</p>
</template>

<style scoped>
/* Mobile first: one column until there is room for the drafting-table layout. */

.builder {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.builder__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: space-between;
  align-items: center;
}

.builder__state {
  margin: 0;
  text-transform: capitalize;
}

.builder__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.builder__actions .btn {
  min-height: 44px;
}

.builder__status {
  margin: 0;
  color: var(--color-accent-text);
}

.blockers {
  margin: 0;
  padding-left: var(--space-6);
  color: var(--color-accent-text);
  font-size: 14px;
}

.sheet {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
}

.sheet__masthead,
.sheet__parties,
.sheet__foot {
  display: grid;
  gap: var(--space-4);
}

.sheet__word {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: 40px;
  line-height: 1;
  letter-spacing: 0.02em;
  margin: 0;
}

.sheet__rev {
  margin: var(--space-1) 0 0;
  font-size: 11px;
  letter-spacing: 0.12em;
}

.label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-text) 60%, transparent);
  margin-bottom: var(--space-2);
}

.rule {
  border: 0;
  border-top: 1px solid var(--color-divider);
  margin: 0;
}

/* The mark is the sender's, so uploading it here updates the business. */
.mark {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 84px;
  padding: var(--space-3);
  border: 1px dashed var(--color-accent);
  background: var(--color-accent-100);
  color: var(--color-accent-800);
  text-align: center;
  font-size: 13px;
  cursor: pointer;
}

.mark--set {
  border-style: solid;
  background: transparent;
}

.mark input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.mark img {
  max-height: 64px;
  max-width: 100%;
  object-fit: contain;
}

.ghost {
  width: 100%;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--color-text) 25%, transparent);
  padding: var(--space-1) 0;
  min-height: 34px;
}

.ghost--block {
  resize: vertical;
}

.ghost:hover {
  border-bottom-color: var(--color-accent);
}

.ghost:focus {
  outline: none;
  border-bottom: 1px solid var(--color-accent);
}

.ghost:read-only,
.ghost:disabled {
  border-bottom-color: transparent;
}

/* The browser draws this one, and at default opacity it disappears against a
   hairline field. `color-scheme` handles its colour; this handles its weight. */
.ghost[type='number'] {
  appearance: textfield;
}

.ghost[type='number']::-webkit-outer-spin-button,
.ghost[type='number']::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.ghost[type='date']::-webkit-calendar-picker-indicator {
  opacity: 0.55;
  padding: var(--space-1);
  cursor: pointer;
}

.ghost[type='date']:hover::-webkit-calendar-picker-indicator,
.ghost[type='date']:focus-within::-webkit-calendar-picker-indicator {
  opacity: 1;
}

.ghost[type='date']:read-only::-webkit-calendar-picker-indicator {
  display: none;
}

.numeric,
.amt {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.field-error {
  margin: var(--space-1) 0 0;
  font-size: 12px;
  color: var(--color-accent-text);
}

.suggestions {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: 0;
}

.reference__row {
  display: grid;
  grid-template-columns: 5rem 1fr;
  align-items: center;
  gap: var(--space-2);
}

.items__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.items__no {
  width: 3rem;
}

.items__remove {
  justify-self: end;
}

.items__entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.items__hint {
  margin: var(--space-1) 0 0;
  font-size: 13px;
}

.totals {
  margin: 0;
  display: grid;
  gap: var(--space-2);
}

.totals > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.totals dt {
  color: color-mix(in srgb, var(--color-text) 62%, transparent);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.totals dd {
  margin: 0;
}

.totals__rate {
  width: 4.5rem;
  min-height: 28px;
}

.totals__amount {
  width: 7rem;
  min-height: 28px;
}

.totals__tax {
  flex-wrap: wrap;
}

.totals__add {
  justify-content: flex-start;
  gap: var(--space-3);
}

.totals__total {
  border-top: 1px solid var(--color-divider);
  padding-top: var(--space-2);
}

.seg {
  display: inline-flex;
  border: 1px solid var(--color-divider);
}

.seg-opt {
  min-width: 2.75rem;
  min-height: 28px;
  padding: 0 var(--space-2);
  font: inherit;
  font-size: 12px;
  background: transparent;
  color: inherit;
  border: 0;
  cursor: pointer;
}

.seg-opt + .seg-opt {
  border-left: 1px solid var(--color-divider);
}

.seg-opt--on {
  background: var(--color-accent);
  color: var(--color-bg);
}

/* Set apart by a rule, the way the design treats the figure that matters. */
.balance {
  display: block;
  margin-top: var(--space-3);
  border-top: 1px solid var(--color-text);
  padding-top: var(--space-2);
}

.balance__label {
  margin: 0;
}

.balance__value {
  margin: 0;
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: 34px;
  line-height: 1.05;
}

.meta {
  display: grid;
  gap: var(--space-3);
  border-top: 1px solid var(--color-text);
  padding-top: var(--space-3);
}

.meta__label {
  display: block;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-text) 60%, transparent);
}

.preview {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.preview__bar {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-divider);
}

.preview__frame {
  flex: 1;
  width: 100%;
  border: 0;
}

@media (min-width: 40rem) {
  .sheet {
    padding: var(--space-8);
  }

  .sheet__masthead {
    grid-template-columns: 10rem 1fr auto;
    align-items: start;
  }

  .sheet__title {
    text-align: right;
  }

  .sheet__parties {
    grid-template-columns: 1fr 1fr 14rem;
  }

  .sheet__foot {
    grid-template-columns: 1fr 20rem;
  }

  /* Without widths the browser divides the columns evenly, so a description
     gets no more room than a quantity. These reflect what each actually holds. */
  .items__qty {
    width: 5rem;
  }

  .items__rate {
    width: 8rem;
  }

  .items__amount {
    width: 9rem;
  }

  .items__entry {
    flex-direction: row;
    align-items: flex-start;
  }

  .items__command {
    flex: 1;
  }

  .meta {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
