// Generates a real invoice PDF with pdfkit (replaces the old Rust printpdf
// backend). Streams directly to the given writable (an HTTP response).
import PDFDocument from 'pdfkit'

export function renderInvoicePdf(res, { invoice, items, payments, client, project, settings }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(res)

  const businessName = settings.business_name || 'Your Business'
  const businessAddress = settings.business_address || ''
  const businessGstin = settings.business_gstin || ''

  doc.fontSize(20).text(businessName, { continued: false })
  if (businessAddress) doc.fontSize(9).fillColor('#555').text(businessAddress)
  if (businessGstin) doc.fontSize(9).fillColor('#555').text(`GSTIN: ${businessGstin}`)
  doc.moveDown()

  doc.fillColor('#000').fontSize(16).text(`Invoice ${invoice.invoice_number}`, { align: 'right' })
  doc.fontSize(10).fillColor('#555')
    .text(`Issue date: ${invoice.issue_date}`, { align: 'right' })
    .text(`Due date: ${invoice.due_date}`, { align: 'right' })
    .text(`Status: ${invoice.status}`, { align: 'right' })
  doc.moveDown()

  doc.fillColor('#000').fontSize(11).text('Bill to:')
  if (client) {
    doc.fontSize(10).fillColor('#333')
      .text(client.name)
    if (client.company) doc.text(client.company)
    if (client.email) doc.text(client.email)
    if (client.address) doc.text(client.address)
  } else {
    doc.fontSize(10).fillColor('#333').text('No client linked')
  }
  if (project) {
    doc.moveDown(0.5).fontSize(10).fillColor('#333').text(`Project: ${project.name}`)
  }
  doc.moveDown()

  // Items table
  const tableTop = doc.y + 10
  const col = { desc: 50, qty: 300, rate: 360, amount: 450 }
  doc.fontSize(10).fillColor('#000')
  doc.text('Description', col.desc, tableTop)
  doc.text('Qty', col.qty, tableTop)
  doc.text('Rate', col.rate, tableTop)
  doc.text('Amount', col.amount, tableTop)
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#ccc').stroke()

  let y = tableTop + 22
  doc.fillColor('#333').fontSize(10)
  for (const item of items) {
    doc.text(item.description || '', col.desc, y, { width: 240 })
    doc.text(String(item.quantity), col.qty, y)
    doc.text(item.rate.toFixed(2), col.rate, y)
    doc.text(item.amount.toFixed(2), col.amount, y)
    y += 20
  }

  y += 10
  doc.moveTo(350, y).lineTo(545, y).strokeColor('#ccc').stroke()
  y += 8
  const totalsPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const balanceDue = invoice.total - totalsPaid

  const line = (label, value) => {
    doc.fontSize(10).fillColor('#333').text(label, 360, y)
    doc.text(value, 450, y)
    y += 18
  }
  line('Subtotal', invoice.subtotal.toFixed(2))
  line('Discount', invoice.discount.toFixed(2))
  line('Tax', invoice.tax.toFixed(2))
  doc.fontSize(11).fillColor('#000')
  line('Total', invoice.total.toFixed(2))
  line('Paid', totalsPaid.toFixed(2))
  doc.fontSize(12).fillColor('#000')
  line('Balance due', balanceDue.toFixed(2))

  y += 10
  if (invoice.payment_terms) {
    doc.fontSize(9).fillColor('#555').text(`Terms: ${invoice.payment_terms}`, 50, y)
    y += 20
  }
  if (invoice.notes) {
    doc.fontSize(9).fillColor('#555').text(`Notes: ${invoice.notes}`, 50, y)
  }

  doc.end()
}
