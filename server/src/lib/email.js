// Thin wrapper around the Resend API — kept as its own module so the OTP
// route never imports the Resend SDK directly, and so tests (see
// server/scripts/smoke-test.js) can exercise the OTP logic without ever
// calling out to Resend. RESEND_API_KEY / RESEND_FROM_EMAIL are read here
// only — never sent to the frontend.
import { Resend } from 'resend'

let client = null
function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — cannot send email. See server/.env.example.')
  }
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

// Deliberately simple, non-marketing email: the code, in large text, plus
// an expiry note. No branding investment intended (see task requirements).
export async function sendOtpEmail(to, code) {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    throw new Error('RESEND_FROM_EMAIL is not set — cannot send email. See server/.env.example.')
  }
  const resend = getClient()
  const text = `Your Nexforge Studio Manager sign-in code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can ignore this email.`
  const html = `
    <p>Your Nexforge Studio Manager sign-in code is:</p>
    <p style="font-size:28px;font-weight:600;letter-spacing:4px;">${code}</p>
    <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
  `
  await resend.emails.send({
    from,
    to,
    subject: 'Your sign-in code',
    text,
    html,
  })
}
