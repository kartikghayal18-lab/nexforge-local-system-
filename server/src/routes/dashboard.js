import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

router.get('/stats', async (req, res) => {
  const [{ rows: projCount }, { rows: clientCount }, { rows: invoices }, { rows: payments }] = await Promise.all([
    pool.query('SELECT count(*)::int AS n FROM projects'),
    pool.query('SELECT count(*)::int AS n FROM clients'),
    pool.query('SELECT id, status, total FROM invoices'),
    pool.query('SELECT invoice_id, amount FROM payments'),
  ])

  const paidByInvoice = {}
  for (const p of payments) paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + Number(p.amount)

  let paid_invoices = 0
  let pending_invoices = 0
  let overdue_invoices = 0
  let total_revenue = 0
  let outstanding_amount = 0

  for (const inv of invoices) {
    const total = Number(inv.total)
    const paidAmt = paidByInvoice[inv.id] || 0
    total_revenue += paidAmt
    if (inv.status === 'Paid') paid_invoices++
    else if (inv.status === 'Overdue') overdue_invoices++
    else if (inv.status === 'Sent' || inv.status === 'Partially Paid') pending_invoices++
    if (inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.status !== 'Draft') {
      outstanding_amount += Math.max(total - paidAmt, 0)
    }
  }

  res.json({
    total_projects: projCount[0].n,
    total_clients: clientCount[0].n,
    total_invoices: invoices.length,
    paid_invoices,
    pending_invoices,
    overdue_invoices,
    total_revenue,
    outstanding_amount,
  })
})

export default router
