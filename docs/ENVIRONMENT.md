# Environment Variables

## Backend (`server/.env`, deployed as Render env vars)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string, e.g. `postgres://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | yes | Long random string. Signs/verifies login tokens. |
| `ENCRYPTION_KEY` | yes | 32 random bytes, base64-encoded (`openssl rand -base64 32`). Used for AES-256-GCM vault encryption. Losing/rotating this makes existing vault rows undecryptable. |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary cloud name. See `docs/CLOUDINARY_SETUP.md`. |
| `CLOUDINARY_API_KEY` | yes | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary API secret. |
| `IMAGE_MAX_SIZE_MB` | no | Defaults to 5. Caps project/logo image uploads. |
| `FILE_MAX_SIZE_MB` | no | Defaults to 20. Caps generic project file uploads. |
| `CORS_ORIGIN` | yes | Exact Vercel origin, e.g. `https://nexforge.vercel.app`. |
| `PORT` | no | Defaults to 4000 (Render sets its own `PORT` automatically). |
| `INVOICE_PREFIX` | no | Defaults to `INV`. Used in `PREFIX-YEAR-NNN` numbering. |

See `server/.env.example` for a copy-pasteable template.

## Frontend (`.env`, set on Vercel as project env vars)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | yes | Base URL of the deployed Render API, no trailing slash, e.g. `https://nexforge-api.onrender.com`. |

See `.env.example` at the repo root.
