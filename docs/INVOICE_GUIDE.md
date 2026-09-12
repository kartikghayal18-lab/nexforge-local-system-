# Invoice Guide

_All steps below describe the desktop-mode flow (`npm run tauri:dev`).
Browser preview mode shows the same screens against read-only demo data._

## 1. Configure your business details first
Go to **Settings > Company Profile**. Fill in business name, email, phone,
address, website, and GSTIN/tax ID if applicable, and optionally upload a
**business logo** (PNG or JPEG, 1MB max) — this appears at the top-left of
every generated invoice PDF. Set your default invoice prefix, currency,
default tax rate, payment terms, and footer text under **Invoice
Settings**/**Tax Settings**, then click **Save**. These are stored in
SQLite and used automatically on every future invoice PDF.

## 2. Create an invoice
Go to **Invoices > New Invoice**. Pick a client (required) and, optionally,
a project to link the invoice to. Set issue date, due date, currency, tax
rate, and discount.

## 3. Add items
Add one row per billable item: description, quantity, rate. The line
amount (qty × rate) and the invoice's subtotal/tax/total are computed
automatically as you type.

## 4. Save
Saving creates the invoice with an automatically generated sequential
number (`<PREFIX>-<YEAR>-<NNN>`, e.g. `NF-2026-004`) — you never type the
invoice number yourself, so numbers can't collide or be duplicated.

## 5. Record a payment
Open the invoice and click **Record Payment**. Enter amount, date, method,
and an optional reference/notes. The invoice's status updates
automatically: fully paid → **Paid**, partially paid → **Partially Paid**
(unless you've manually set it to **Cancelled**, which is never
overridden by a payment). The **Balance Due** banner always reflects
`total − sum(payments)`.

## 6. Generate a PDF
On the invoice's detail page, click **Export PDF**. A native macOS save
dialog opens; choose where to save the file. This calls the Rust backend
(`invoices_generate_pdf`, using the `printpdf` crate) to draw a real PDF
document — not a screenshot and not the browser's print-to-PDF — containing
your logo, business and client details, the linked project (if any),
itemized services, subtotal/discount/tax/total, amount paid, balance due,
payment status, terms, and notes.

A secondary **Print** button (browser print-to-PDF) remains available as a
fallback/quick-preview option, but Export PDF is the primary path.

## 7. Back up your invoice data
Invoices, invoice items, and payments are included automatically in a full
encrypted backup — see **Settings > Backup & Security > Export Backup**,
and docs/DATABASE.md / docs/VAULT_SECURITY.md for what exactly is included
and how it's protected.
