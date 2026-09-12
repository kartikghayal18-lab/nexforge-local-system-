# Cloudflare R2 Setup

1. **Create a bucket**: Cloudflare dashboard → R2 → Create bucket, e.g.
   `nexforge-files`. Note your Account ID (shown on the R2 overview page).
2. **Create an API token**: R2 → Manage R2 API Tokens → Create API Token.
   Scope it to "Object Read & Write" on the bucket above only (not
   account-wide). Copy the Access Key ID and Secret Access Key — the secret
   is shown once.
3. **Set backend env vars** (Render): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
4. **CORS on the bucket** (required — the frontend PUTs file bytes directly
   to R2 using a presigned URL, so the browser needs CORS permission from
   R2 itself, not just from your API). Bucket → Settings → CORS Policy:

   ```json
   [
     {
       "AllowedOrigins": ["https://your-app.vercel.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Add `http://localhost:5173` too while developing locally.

5. Nothing else is public: the bucket itself does not need a public-access
   toggle, since every read/write goes through a short-lived presigned URL
   minted by the backend (`server/src/lib/r2.js`) — R2 keys never reach the
   frontend.
