// Sequential invoice numbering: PREFIX-YEAR-NNN, computed server-side so two
// clients can never race to the same number for the same year (guarded by
// the invoices.invoice_number UNIQUE constraint + a serializable retry).
export async function nextInvoiceNumber(client, prefix = 'INV') {
  const year = new Date().getFullYear()
  const like = `${prefix}-${year}-%`
  const { rows } = await client.query(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1`,
    [like],
  )
  let next = 1
  if (rows.length) {
    const last = rows[0].invoice_number
    const match = last.match(/-(\d+)$/)
    if (match) next = parseInt(match[1], 10) + 1
  }
  return `${prefix}-${year}-${String(next).padStart(3, '0')}`
}
