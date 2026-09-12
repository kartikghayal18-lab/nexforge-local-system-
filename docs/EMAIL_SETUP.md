# Email Setup

**Current status: not implemented.** Nexforge Studio Manager does not send
email today — there is no SMTP client, no email API integration, and no
"Send Invoice by Email" button wired to anything in the current codebase.
This document exists as a placeholder per the project's documentation
checklist, and to make clear what would be required if this feature is
added later, so nobody assumes it already works.

## If email sending is added later
Recommended approach for a local-first Tauri app: call an email API (e.g.
Resend, Postmark, or SMTP via a Rust crate like `lettre`) from the Rust
backend — never from the frontend — so credentials never pass through
frontend code or `localStorage`.

- **Where credentials would live:** the Secure Vault (a new "Email" secret
  category), not a `.env` file — the vault encrypts them at rest.
- **What you'd need:** an SMTP host/port/username/password, or an API key
  from whichever transactional email provider is chosen, plus a verified
  "from" address.
- **How you'd test it:** send to your own address first, using the
  provider's sandbox/test mode if one exists, before sending to a real
  client.
- **Security notes:** never hardcode an email password in source, never
  log the credential, and never put it in this repo's `.env` (see
  docs/ENVIRONMENT.md) — use the vault.

Until this is implemented, invoices are shared by generating the PDF
(docs/INVOICE_GUIDE.md) and attaching/sending it manually through whatever
email client you already use.
