// Invoice Generator Application
// Main application state
const InvoiceApp = {
    invoice: {
        number: '1',
        date: '',
        paymentTerms: '',
        dueDate: '',
        poNumber: '',
        from: '',
        billTo: '',
        shipTo: '',
        items: [],
        notes: '',
        terms: '',
        subtotal: 0,
        discount: 0,
        tax: 0,
        taxType: 'percentage', // 'percentage' or 'fixed'
        shipping: 0,
        total: 0,
        amountPaid: 0,
        balanceDue: 0,
        currency: 'USD',
        theme: 'light',
        logo: null
    },
    history: [],
    currentCurrency: { code: 'USD', symbol: 'US$' }
};

// Currency data - will be loaded from data.json
let currencies = {};

// Load currencies from data.json
async function loadCurrencies() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();

        // Convert array to object for easy lookup
        data.currencies.forEach(currency => {
            currencies[currency.code] = currency;
        });

        // Populate the currency select element
        populateCurrencySelect();

        // Set default currency if not already set
        if (!InvoiceApp.currentCurrency.code) {
            InvoiceApp.currentCurrency = currencies['USD'];
        }
    } catch (error) {
        console.error('Error loading currencies:', error);
        // Fallback to default currencies if loading fails
        currencies = {
            'USD': { code: 'USD', symbol: '$', name: 'USD ($)' },
            'EUR': { code: 'EUR', symbol: '€', name: 'EUR (€)' },
            'GBP': { code: 'GBP', symbol: '£', name: 'GBP (£)' }
        };
        populateCurrencySelect();
    }
}

// Populate currency select dropdown
function populateCurrencySelect() {
    const select = document.getElementById('currencySelect');
    if (!select) return;

    // Clear existing options
    select.innerHTML = '';

    // Add all currencies
    Object.values(currencies).forEach(currency => {
        const option = document.createElement('option');
        option.value = currency.code;
        option.textContent = currency.name;
        option.setAttribute('data-symbol', currency.symbol || currency.code);
        select.appendChild(option);
    });

    // Set the selected value to current currency
    select.value = InvoiceApp.invoice.currency;
}

// Initialize the application
async function init() {
    await loadCurrencies();
    loadFromLocalStorage();
    setupEventListeners();
    addDefaultLineItem();
    setDefaultDate();
    updateAllCalculations();
    loadHistory();
}

// Set today's date as default
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    InvoiceApp.invoice.date = today;
}

// Add a default line item on page load
function addDefaultLineItem() {
    const item = {
        id: Date.now(),
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0
    };
    InvoiceApp.invoice.items.push(item);
    renderLineItems();
}

// Render all line items
function renderLineItems() {
    const container = document.getElementById('lineItemsContainer');
    container.innerHTML = '';

    InvoiceApp.invoice.items.forEach((item, index) => {
        const row = createLineItemRow(item, index);
        container.appendChild(row);
    });
}

// Create a single line item row
function createLineItemRow(item, index) {
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.setAttribute('role', 'row');
    row.dataset.itemId = item.id;

    row.innerHTML = `
        <div class="line-item-cell col-item" role="cell">
            <textarea
                class="item-input"
                placeholder="Description of item/service..."
                aria-label="Item description"
                data-field="description"
            >${item.description}</textarea>
        </div>
        <div class="line-item-cell col-quantity" role="cell">
            <input
                type="number"
                class="item-input"
                value="${item.quantity}"
                min="0"
                step="1"
                aria-label="Quantity"
                data-field="quantity"
            >
        </div>
        <div class="line-item-cell col-rate" role="cell">
            <div class="rate-input-wrapper">
                <span class="rate-prefix">$</span>
                <input
                    type="number"
                    class="item-input"
                    value="${item.rate}"
                    min="0"
                    step="0.01"
                    aria-label="Rate"
                    data-field="rate"
                >
            </div>
        </div>
        <div class="line-item-cell col-amount" role="cell">
            <span class="amount-display">${formatCurrency(item.amount)}</span>
        </div>
        ${InvoiceApp.invoice.items.length > 1 ? `
            <button type="button" class="delete-item-btn" aria-label="Delete line item">
                &times;
            </button>
        ` : ''}
    `;

    // Add event listeners for inputs
    const inputs = row.querySelectorAll('.item-input');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => handleLineItemChange(item.id, e));
        input.addEventListener('change', (e) => handleLineItemChange(item.id, e));
    });

    // Add delete button listener
    const deleteBtn = row.querySelector('.delete-item-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteLineItem(item.id));
    }

    return row;
}

// Handle line item input changes
function handleLineItemChange(itemId, event) {
    const item = InvoiceApp.invoice.items.find(i => i.id === itemId);
    if (!item) return;

    const field = event.target.dataset.field;
    let value = event.target.value;

    if (field === 'quantity' || field === 'rate') {
        value = parseFloat(value) || 0;
    }

    item[field] = value;

    // Calculate amount
    item.amount = item.quantity * item.rate;

    // Update the amount display
    const row = event.target.closest('.line-item-row');
    const amountDisplay = row.querySelector('.amount-display');
    amountDisplay.textContent = formatCurrency(item.amount);

    updateAllCalculations();
}

// Delete a line item
function deleteLineItem(itemId) {
    if (InvoiceApp.invoice.items.length === 1) {
        showToast('Cannot delete the last line item');
        return;
    }

    InvoiceApp.invoice.items = InvoiceApp.invoice.items.filter(i => i.id !== itemId);
    renderLineItems();
    updateAllCalculations();
}

// Add a new line item
function addLineItem() {
    const item = {
        id: Date.now(),
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0
    };
    InvoiceApp.invoice.items.push(item);
    renderLineItems();
    updateAllCalculations();

    // Focus on the new item's description field
    setTimeout(() => {
        const newRow = document.querySelector(`[data-item-id="${item.id}"]`);
        if (newRow) {
            const descInput = newRow.querySelector('[data-field="description"]');
            descInput?.focus();
        }
    }, 100);
}

// Calculate subtotal
function calculateSubtotal() {
    return InvoiceApp.invoice.items.reduce((sum, item) => sum + item.amount, 0);
}

// Update all calculations
function updateAllCalculations() {
    const subtotal = calculateSubtotal();
    InvoiceApp.invoice.subtotal = subtotal;

    // Calculate discount
    const discount = parseFloat(InvoiceApp.invoice.discount) || 0;

    // Calculate subtotal after discount
    const subtotalAfterDiscount = subtotal - discount;

    // Calculate tax
    let taxAmount = 0;
    const taxValue = parseFloat(InvoiceApp.invoice.tax) || 0;
    if (InvoiceApp.invoice.taxType === 'percentage') {
        taxAmount = (subtotalAfterDiscount * taxValue) / 100;
    } else {
        taxAmount = taxValue;
    }

    // Calculate shipping
    const shipping = parseFloat(InvoiceApp.invoice.shipping) || 0;

    // Calculate total
    const total = subtotalAfterDiscount + taxAmount + shipping;
    InvoiceApp.invoice.total = total;

    // Calculate balance due
    const amountPaid = parseFloat(InvoiceApp.invoice.amountPaid) || 0;
    InvoiceApp.invoice.balanceDue = total - amountPaid;

    // Update displays
    document.getElementById('subtotalDisplay').textContent = formatCurrency(subtotal);
    document.getElementById('totalDisplay').textContent = formatCurrency(total);
    document.getElementById('balanceDueDisplay').textContent = formatCurrency(InvoiceApp.invoice.balanceDue);
}

// Format currency
function formatCurrency(amount) {
    const symbol = InvoiceApp.currentCurrency.symbol;
    const formatted = Math.abs(amount).toFixed(2);
    return `${symbol}${formatted}`;
}

// Setup event listeners
function setupEventListeners() {
    // Add line item button
    document.getElementById('addLineBtn').addEventListener('click', addLineItem);

    // Form inputs
    document.getElementById('invoiceNumber').addEventListener('input', (e) => {
        InvoiceApp.invoice.number = e.target.value;
    });

    document.getElementById('fromAddress').addEventListener('input', (e) => {
        InvoiceApp.invoice.from = e.target.value;
    });

    document.getElementById('billTo').addEventListener('input', (e) => {
        InvoiceApp.invoice.billTo = e.target.value;
    });

    document.getElementById('shipTo').addEventListener('input', (e) => {
        InvoiceApp.invoice.shipTo = e.target.value;
    });

    document.getElementById('invoiceDate').addEventListener('change', (e) => {
        InvoiceApp.invoice.date = e.target.value;
    });

    document.getElementById('paymentTerms').addEventListener('input', (e) => {
        InvoiceApp.invoice.paymentTerms = e.target.value;
    });

    document.getElementById('dueDate').addEventListener('change', (e) => {
        InvoiceApp.invoice.dueDate = e.target.value;
    });

    document.getElementById('poNumber').addEventListener('input', (e) => {
        InvoiceApp.invoice.poNumber = e.target.value;
    });

    document.getElementById('notesInput').addEventListener('input', (e) => {
        InvoiceApp.invoice.notes = e.target.value;
    });

    document.getElementById('termsInput').addEventListener('input', (e) => {
        InvoiceApp.invoice.terms = e.target.value;
    });

    // Tax input and toggle
    document.getElementById('taxInput').addEventListener('input', (e) => {
        InvoiceApp.invoice.tax = parseFloat(e.target.value) || 0;
        updateAllCalculations();
    });

    document.querySelector('.tax-toggle').addEventListener('click', toggleTaxType);

    // Amount paid
    document.getElementById('amountPaid').addEventListener('input', (e) => {
        InvoiceApp.invoice.amountPaid = parseFloat(e.target.value) || 0;
        updateAllCalculations();
    });

    // Discount and shipping buttons
    document.getElementById('addDiscountBtn').addEventListener('click', showDiscount);
    document.getElementById('addShippingBtn').addEventListener('click', showShipping);

    // Theme select (if exists)
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', handleThemeChange);
    }

    // Currency select
    document.getElementById('currencySelect').addEventListener('change', handleCurrencyChange);

    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadInvoice);

    // Save template button
    document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);

    // Logo upload
    document.getElementById('logoInput').addEventListener('change', handleLogoUpload);

    // History toggle
    document.getElementById('historyToggle').addEventListener('click', toggleHistory);
    document.getElementById('historyClose').addEventListener('click', closeHistory);
    document.getElementById('overlay').addEventListener('click', closeHistory);
    document.getElementById('newInvoiceBtn').addEventListener('click', createNewInvoice);

    // Header theme toggle
    document.getElementById('headerThemeToggle').addEventListener('click', toggleThemeInHeader);
}

// Toggle tax type between percentage and fixed
function toggleTaxType() {
    if (InvoiceApp.invoice.taxType === 'percentage') {
        InvoiceApp.invoice.taxType = 'fixed';
        document.querySelector('.tax-percent').textContent = '$';
        document.querySelector('.tax-toggle').title = 'Switch to percentage';
    } else {
        InvoiceApp.invoice.taxType = 'percentage';
        document.querySelector('.tax-percent').textContent = '%';
        document.querySelector('.tax-toggle').title = 'Switch to fixed amount';
    }
    updateAllCalculations();
}

// Show discount row
function showDiscount() {
    document.getElementById('discountRow').style.display = 'flex';
    document.getElementById('addDiscountBtn').style.display = 'none';
    document.getElementById('discountInput').addEventListener('input', (e) => {
        InvoiceApp.invoice.discount = parseFloat(e.target.value) || 0;
        updateAllCalculations();
    });
}

// Remove discount
function removeDiscount() {
    document.getElementById('discountRow').style.display = 'none';
    document.getElementById('addDiscountBtn').style.display = 'inline-block';
    InvoiceApp.invoice.discount = 0;
    document.getElementById('discountInput').value = '0';
    updateAllCalculations();
}

// Show shipping row
function showShipping() {
    document.getElementById('shippingRow').style.display = 'flex';
    document.getElementById('addShippingBtn').style.display = 'none';
    document.getElementById('shippingInput').addEventListener('input', (e) => {
        InvoiceApp.invoice.shipping = parseFloat(e.target.value) || 0;
        updateAllCalculations();
    });
}

// Remove shipping
function removeShipping() {
    document.getElementById('shippingRow').style.display = 'none';
    document.getElementById('addShippingBtn').style.display = 'inline-block';
    InvoiceApp.invoice.shipping = 0;
    document.getElementById('shippingInput').value = '0';
    updateAllCalculations();
}

// Handle currency change
function handleCurrencyChange(event) {
    const currencyCode = event.target.value;
    const selected = event.target.selectedOptions[0];
    const symbol = selected.dataset.symbol;

    InvoiceApp.currentCurrency = {
        code: currencyCode,
        symbol: symbol
    };
    InvoiceApp.invoice.currency = currencyCode;

    // Update all currency displays
    updateAllCalculations();
    renderLineItems();

    // Update currency prefix in rate column
    document.querySelectorAll('.rate-prefix').forEach(el => {
        el.textContent = symbol.replace('US', '').replace('CA', '').replace('AU', '');
    });

    // Update amount paid prefix
    document.querySelectorAll('.amount-paid-prefix').forEach(el => {
        el.textContent = symbol.replace('US', '').replace('CA', '').replace('AU', '');
    });

    // Auto-save currency preference
    const defaults = JSON.parse(localStorage.getItem('invoiceDefaults') || '{}');
    defaults.currency = currencyCode;
    localStorage.setItem('invoiceDefaults', JSON.stringify(defaults));
}

// Handle theme change
function handleThemeChange(event) {
    const theme = event.target.value;
    InvoiceApp.invoice.theme = theme;

    // Remove all theme classes
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-docker');

    // Add the selected theme class
    document.body.classList.add(`theme-${theme}`);

    // Update header icon
    updateThemeIcon(theme);

    // Update sidebar dropdown if it exists
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = theme;
    }

    // Auto-save theme preference
    const defaults = JSON.parse(localStorage.getItem('invoiceDefaults') || '{}');
    defaults.theme = theme;
    localStorage.setItem('invoiceDefaults', JSON.stringify(defaults));
}

// Toggle theme from header button (light/dark only)
function toggleThemeInHeader() {
    const currentTheme = InvoiceApp.invoice.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    InvoiceApp.invoice.theme = newTheme;
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-docker');
    document.body.classList.add(`theme-${newTheme}`);

    // Update sidebar dropdown if it exists
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = newTheme;
    }

    updateThemeIcon(newTheme);

    // Auto-save theme preference
    const defaults = JSON.parse(localStorage.getItem('invoiceDefaults') || '{}');
    defaults.theme = newTheme;
    localStorage.setItem('invoiceDefaults', JSON.stringify(defaults));
}

// Update theme icon
function updateThemeIcon(theme) {
    const icon = document.querySelector('#headerThemeToggle .theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '☾' : '☀';
    }
}

// Handle logo upload
function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const logoPreview = document.getElementById('logoPreview');
        const logoPlaceholder = document.getElementById('logoPlaceholder');

        logoPreview.src = e.target.result;
        logoPreview.classList.add('visible');
        logoPlaceholder.classList.add('hidden');

        InvoiceApp.invoice.logo = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Download invoice as PDF
function downloadInvoice() {
    // Save current invoice to history
    saveToHistory();

    // For now, use print functionality
    // In a production app, you'd use a library like jsPDF or html2pdf
    window.print();
    showToast('Invoice downloaded');
}

// History management
function toggleHistory() {
    const panel = document.getElementById('historyPanel');
    const overlay = document.getElementById('overlay');
    const toggle = document.getElementById('historyToggle');

    const isOpen = panel.classList.contains('open');

    if (isOpen) {
        closeHistory();
    } else {
        panel.classList.add('open');
        overlay.classList.add('active');
        toggle.setAttribute('aria-expanded', 'true');
    }
}

function closeHistory() {
    const panel = document.getElementById('historyPanel');
    const overlay = document.getElementById('overlay');
    const toggle = document.getElementById('historyToggle');

    panel.classList.remove('open');
    overlay.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('invoiceHistory') || '[]');
    InvoiceApp.history = history;
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('historyList');
    container.innerHTML = '';

    if (InvoiceApp.history.length === 0) {
        container.innerHTML = '<div class="history-empty">No invoices yet</div>';
        return;
    }

    InvoiceApp.history.forEach((invoice, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.setAttribute('role', 'listitem');

        const date = new Date(invoice.savedAt).toLocaleDateString();
        const number = invoice.number || 'N/A';
        const total = formatCurrency(invoice.total);

        item.innerHTML = `
            <div class="history-item-content">
                <div class="history-item-number">Invoice #${number}</div>
                <div class="history-item-date">${date}</div>
                <div class="history-item-total">${total}</div>
            </div>
            <button class="history-item-delete" aria-label="Delete invoice" data-index="${index}">
                &times;
            </button>
        `;

        item.querySelector('.history-item-content').addEventListener('click', () => {
            loadInvoiceFromHistory(index);
        });

        item.querySelector('.history-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFromHistory(index);
        });

        container.appendChild(item);
    });
}

function saveToHistory() {
    const invoiceData = {
        ...InvoiceApp.invoice,
        savedAt: new Date().toISOString()
    };

    InvoiceApp.history.unshift(invoiceData);

    // Keep only last 50 invoices
    if (InvoiceApp.history.length > 50) {
        InvoiceApp.history = InvoiceApp.history.slice(0, 50);
    }

    localStorage.setItem('invoiceHistory', JSON.stringify(InvoiceApp.history));
    renderHistory();
}

function loadInvoiceFromHistory(index) {
    const invoice = InvoiceApp.history[index];
    if (!invoice) return;

    InvoiceApp.invoice = { ...invoice };

    // Update all form fields
    document.getElementById('invoiceNumber').value = invoice.number;
    document.getElementById('fromAddress').value = invoice.from;
    document.getElementById('billTo').value = invoice.billTo;
    document.getElementById('shipTo').value = invoice.shipTo;
    document.getElementById('invoiceDate').value = invoice.date;
    document.getElementById('paymentTerms').value = invoice.paymentTerms;
    document.getElementById('dueDate').value = invoice.dueDate;
    document.getElementById('poNumber').value = invoice.poNumber;
    document.getElementById('notesInput').value = invoice.notes;
    document.getElementById('termsInput').value = invoice.terms;
    document.getElementById('taxInput').value = invoice.tax;
    document.getElementById('amountPaid').value = invoice.amountPaid;

    // Update currency
    document.getElementById('currencySelect').value = invoice.currency;
    handleCurrencyChange({ target: document.getElementById('currencySelect') });

    // Update theme
    if (invoice.theme) {
        InvoiceApp.invoice.theme = invoice.theme;
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-docker');
        document.body.classList.add(`theme-${invoice.theme}`);
        updateThemeIcon(invoice.theme);
    }

    // Render line items
    renderLineItems();
    updateAllCalculations();

    closeHistory();
    showToast('Invoice loaded');
}

function deleteFromHistory(index) {
    InvoiceApp.history.splice(index, 1);
    localStorage.setItem('invoiceHistory', JSON.stringify(InvoiceApp.history));
    renderHistory();
    showToast('Invoice deleted');
}

function createNewInvoice() {
    if (confirm('Create a new invoice? Any unsaved changes will be lost.')) {
        location.reload();
    }
}

// Save default settings
function saveDefaults() {
    const defaults = {
        currency: InvoiceApp.invoice.currency,
        theme: InvoiceApp.invoice.theme
    };
    localStorage.setItem('invoiceDefaults', JSON.stringify(defaults));
    showToast('Defaults saved');
}

// Save invoice template
function saveTemplate() {
    const template = {
        from: document.getElementById('fromAddress').value,
        paymentTerms: document.getElementById('paymentTerms').value,
        notes: document.getElementById('notesInput').value,
        terms: document.getElementById('termsInput').value,
        tax: document.getElementById('taxInput').value
    };
    localStorage.setItem('invoiceTemplate', JSON.stringify(template));
    showToast('Template saved');
}

// Load from localStorage
function loadFromLocalStorage() {
    const defaults = JSON.parse(localStorage.getItem('invoiceDefaults') || '{}');

    if (defaults.currency) {
        InvoiceApp.invoice.currency = defaults.currency;
        InvoiceApp.currentCurrency = currencies[defaults.currency] || currencies.USD;
        document.getElementById('currencySelect').value = defaults.currency;
    }

    if (defaults.theme && (defaults.theme === 'light' || defaults.theme === 'dark')) {
        InvoiceApp.invoice.theme = defaults.theme;
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-docker');
        document.body.classList.add(`theme-${defaults.theme}`);
        updateThemeIcon(defaults.theme);
    } else {
        // Set light as default theme
        InvoiceApp.invoice.theme = 'light';
        document.body.classList.add('theme-light');
        updateThemeIcon('light');
    }

    // Load template data
    const template = JSON.parse(localStorage.getItem('invoiceTemplate') || '{}');
    if (template.from) {
        document.getElementById('fromAddress').value = template.from;
        InvoiceApp.invoice.from = template.from;
    }
    if (template.paymentTerms) {
        document.getElementById('paymentTerms').value = template.paymentTerms;
        InvoiceApp.invoice.paymentTerms = template.paymentTerms;
    }
    if (template.notes) {
        document.getElementById('notesInput').value = template.notes;
        InvoiceApp.invoice.notes = template.notes;
    }
    if (template.terms) {
        document.getElementById('termsInput').value = template.terms;
        InvoiceApp.invoice.terms = template.terms;
    }
    if (template.tax !== undefined) {
        document.getElementById('taxInput').value = template.tax;
        InvoiceApp.invoice.tax = template.tax;
    }
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
