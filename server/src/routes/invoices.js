import { Router } from 'express'
import { pool } from '../db/pool.js'
import { nextInvoiceNumber } from '../lib/invoiceNumber.js'
import { renderInvoicePdf } from '../lib/pdf.js'

const router = Router()

function computeTotals(items, discount, taxRatePercent) {
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.rate, 0)
  const taxable = Math.max(subtotal - discount, 0)
  const tax = (taxable * taxRatePercent) / 100
  const total = taxable + tax
  return { subtotal, tax, total }
}

async function loadInvoiceFull(id) {
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [id])
  if (!rows.length) return null
  const invoice = rows[0]
  const { rows: items } = await pool.query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC',
    [id],
  )
  const { rows: payments } = await pool.query('SELECT * FROM payments WHERE invoice_id = $1', [id])
  const amount_paid = payments.reduce((s, p) => s + Number(p.amount), 0)
  return { ...invoice, items, amount_paid }
}

router.get('/', async (req, res) => {
  const { rows: invoices } = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC')
  const { rows: payments } = await pool.query('SELECT invoice_id, amount FROM payments')
  const paidByInvoice = {}
  for (const p of payments) paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + Number(p.amount)
  const { rows: items } = await pool.query('SELECT * FROM invoice_items ORDER BY sort_order ASC')
  const itemsByInvoice = {}
  for (const it of items) (itemsByInvoice[it.invoice_id] ??= []).push(it)
  res.json(invoices.map((inv) => ({ ...inv, items: itemsByInvoice[inv.id] || [], amount_paid: paidByInvoice[inv.id] || 0 })))
})

router.get('/:id', async (req, res) => {
  const invoice = await loadInvoiceFull(req.params.id)
  if (!invoice) return res.status(404).json({ error: 'not found' })
  res.json(invoice)
})

router.post('/', async (req, res) => {
  const b = req.body || {}
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const invoiceNumber = b.invoice_number || (await nextInvoiceNumber(client, process.env.INVOICE_PREFIX || 'INV'))
    const { subtotal, tax, total } = computeTotals(b.items || [], b.discount || 0, b.tax_rate_percent || 0)
    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [invoiceNumber, b.client_id ?? null, b.project_id ?? null, b.issue_date, b.due_date, b.status || 'Draft', b.currency || 'INR', subtotal, b.discount || 0, tax, total, b.notes ?? null, b.payment_terms ?? null],
    )
    const invoiceId = rows[0].id
    let order = 0
    for (const item of b.items || []) {
      const amount = item.quantity * item.rate
      await client.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [invoiceId, item.description ?? '', item.quantity, item.rate, amount, order++],
      )
    }
    await client.query('COMMIT')
    res.json({ id: invoiceId, invoice_number: invoiceNumber })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.put('/:id', async (req, res) => {
  const b = req.body || {}
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { subtotal, tax, total } = computeTotals(b.items || [], b.discount || 0, b.tax_rate_percent || 0)
    await client.query(
      `UPDATE invoices SET client_id=$1, project_id=$2, issue_date=$3, due_date=$4, status=$5, currency=$6,
       subtotal=$7, discount=$8, tax=$9, total=$10, notes=$11, payment_terms=$12, updated_at=now() WHERE id=$13`,
      [b.client_id ?? null, b.project_id ?? null, b.issue_date, b.due_date, b.status, b.currency, subtotal, b.discount || 0, tax, total, b.notes ?? null, b.payment_terms ?? null, req.params.id],
    )
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id])
    let order = 0
    for (const item of b.items || []) {
      const amount = item.quantity * item.rate
      await client.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.params.id, item.description ?? '', item.quantity, item.rate, amount, order++],
      )
    }
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.post('/:id/status', async (req, res) => {
  await pool.query('UPDATE invoices SET status=$1, updated_at=now() WHERE id=$2', [req.body.status, req.params.id])
  res.json({ ok: true })
})

router.post('/:id/duplicate', async (req, res) => {
  const original = await loadInvoiceFull(req.params.id)
  if (!original) return res.status(404).json({ error: 'not found' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const invoiceNumber = await nextInvoiceNumber(client, process.env.INVOICE_PREFIX || 'INV')
    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms)
       VALUES ($1,$2,$3,$4,$5,'Draft',$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [invoiceNumber, original.client_id, original.project_id, original.issue_date, original.due_date, original.currency, original.subtotal, original.discount, original.tax, original.total, original.notes, original.payment_terms],
    )
    const newId = rows[0].id
    let order = 0
    for (const item of original.items) {
      await client.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [newId, item.description, item.quantity, item.rate, item.amount, order++],
      )
    }
    await client.query('COMMIT')
    res.json({ id: newId, invoice_number: invoiceNumber })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

router.get('/:id/pdf', async (req, res) => {
  const invoice = await loadInvoiceFull(req.params.id)
  if (!invoice) return res.status(404).json({ error: 'not found' })
  const { rows: clientRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [invoice.client_id])
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [invoice.project_id])
  const { rows: paymentRows } = await pool.query('SELECT * FROM payments WHERE invoice_id = $1', [invoice.id])
  const { rows: settingsRows } = await pool.query('SELECT key, value FROM business_settings')
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]))

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`)
  renderInvoicePdf(res, {
    invoice,
    items: invoice.items,
    payments: paymentRows,
    client: clientRows[0] || null,
    project: projectRows[0] || null,
    settings,
  })
})

export default router
