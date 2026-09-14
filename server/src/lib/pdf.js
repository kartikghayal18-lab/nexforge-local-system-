// Generates a real invoice PDF with pdfkit (replaces the old Rust printpdf
// backend). Streams directly to the given writable (an HTTP response).
import PDFDocument from 'pdfkit'

// Fetches the business logo image bytes so they can be embedded in the PDF
// header. Best-effort only: a slow/dead/unreachable Cloudinary URL, a
// non-2xx response, or a format pdfkit can't embed must never fail PDF
// generation — the invoice should still render, just without the logo.
// 5s timeout so a hung upstream can't hang PDF generation indefinitely.
async function fetchLogoBuffer(logoUrl) {
  if (!logoUrl) return null
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.error('[pdf] logo fetch failed — non-OK response:', res.status)
      return null
    }
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[pdf] logo fetch failed:', err.message)
    return null
  }
}

export async function renderInvoicePdf(res, { invoice, items, payments, client, project, settings }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(res)

  const businessName = settings.business_name || 'Your Business'
  const businessAddress = settings.business_address || ''
  const businessGstin = settings.business_gstin || ''
  const businessPhone = settings.business_phone || ''
  const businessEmail = settings.business_email || ''
  const businessWebsite = settings.business_website || ''
  const contactLine = [businessEmail, businessPhone, businessWebsite].filter(Boolean).join('  ·  ')

  // Logo — fetched before any drawing so a failure never leaves the doc
  // half-drawn; drawn at fixed top-right coordinates so it doesn't disturb
  // the existing left-aligned header flow below.
  const logoBuffer = await fetchLogoBuffer(settings.logo_url)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 455, 45, { width: 90, height: 90, fit: [90, 90] })
    } catch (err) {
      // pdfkit throws synchronously on an unsupported/corrupt image format
      // (it only supports JPEG and PNG) — log and keep rendering the rest
      // of the PDF without the logo.
      console.error('[pdf] logo embed failed (unsupported image format):', err.message)
    }
  }

  doc.fontSize(20).text(businessName, { continued: false })
  if (businessAddress) doc.fontSize(9).fillColor('#555').text(businessAddress)
  if (businessGstin) doc.fontSize(9).fillColor('#555').text(`GSTIN: ${businessGstin}`)
  if (contactLine) doc.fontSize(9).fillColor('#555').text(contactLine)
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
    y += 20
  }

  // Payment details — omit entirely when nothing is configured, never a
  // hardcoded placeholder (matches the on-screen preview's behavior).
  const paymentLines = [
    settings.bank_name && `Bank: ${settings.bank_name}`,
    settings.account_name && `Account Name: ${settings.account_name}`,
    settings.account_number && `Account No.: ${settings.account_number}`,
    settings.ifsc_code && `IFSC: ${settings.ifsc_code}`,
    settings.upi_id && `UPI: ${settings.upi_id}`,
  ].filter(Boolean)
  if (paymentLines.length) {
    doc.moveDown(0.5)
    doc.fontSize(9).fillColor('#000').text('Payment Details:', 50, doc.y)
    doc.fontSize(9).fillColor('#555').text(paymentLines.join('   '), 50, doc.y + 2)
  }

  doc.end()
}
