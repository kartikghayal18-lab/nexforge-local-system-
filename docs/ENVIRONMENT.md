# Environment Variables

## Backend (`server/.env`, deployed as Render env vars)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string, e.g. `postgres://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | yes | Long random string. Signs/verifies login tokens. |
| `ENCRYPTION_KEY` | yes | 32 random bytes, base64-encoded (`openssl rand -base64 32`). Used for AES-256-GCM vault encryption. Losing/rotating this makes existing vault rows undecryptable. |
| `R2_ACCOUNT_ID` | yes (for files) | Cloudflare account ID. |
| `R2_ACCESS_KEY_ID` | yes (for files) | R2 API token access key. |
| `R2_SECRET_ACCESS_KEY` | yes (for files) | R2 API token secret. |
| `R2_BUCKET_NAME` | yes (for files) | Bucket used for project files + business logo. |
| `CORS_ORIGIN` | yes | Exact Vercel origin, e.g. `https://nexforge.vercel.app`. |
| `PORT` | no | Defaults to 4000 (Render sets its own `PORT` automatically). |
| `INVOICE_PREFIX` | no | Defaults to `INV`. Used in `PREFIX-YEAR-NNN` numbering. |

See `server/.env.example` for a copy-pasteable template.

## Frontend (`.env`, set on Vercel as project env vars)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | yes | Base URL of the deployed Render API, no trailing slash, e.g. `https://nexforge-api.onrender.com`. |

See `.env.example` at the repo root.
