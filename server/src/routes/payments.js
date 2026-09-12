import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

async function refreshInvoiceStatus(client, invoiceId) {
  const { rows: invRows } = await client.query('SELECT total, status FROM invoices WHERE id = $1', [invoiceId])
  if (!invRows.length) return
  const { rows: payRows } = await client.query('SELECT COALESCE(SUM(amount),0)::float AS paid FROM payments WHERE invoice_id = $1', [invoiceId])
  const paid = payRows[0].paid
  const total = Number(invRows[0].total)
  let status = invRows[0].status
  if (paid <= 0) {
    if (status === 'Paid' || status === 'Partially Paid') status = 'Sent'
  } else if (paid >= total && total > 0) {
    status = 'Paid'
  } else {
    status = 'Partially Paid'
  }
  await client.query('UPDATE invoices SET status=$1, updated_at=now() WHERE id=$2', [status, invoiceId])
}

router.get('/invoice/:invoiceId', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC', [req.params.invoiceId])
  res.json(rows)
})

router.post('/', async (req, res) => {
  const b = req.body || {}
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [b.invoice_id, b.amount, b.payment_date, b.payment_method ?? null, b.reference ?? null, b.notes ?? null],
    )
    await refreshInvoiceStatus(client, b.invoice_id)
    await client.query('COMMIT')
    res.json({ id: rows[0].id })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT invoice_id FROM payments WHERE id = $1', [req.params.id])
    await client.query('DELETE FROM payments WHERE id = $1', [req.params.id])
    if (rows.length) await refreshInvoiceStatus(client, rows[0].invoice_id)
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

export default router
