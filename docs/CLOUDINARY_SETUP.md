# Cloudinary Setup

Cloudinary is the storage backend for every durable file/image upload in
this app: project cover/gallery images, project files/documents, and the
business logo. Replaces the earlier local-disk (images) and Cloudflare R2
(generic files) approaches — one provider, durable identically in
development and production.

1. **Create a free account** at cloudinary.com if you don't have one.
2. **Copy your credentials**: Cloudinary dashboard → Home (or Settings →
   API Keys) shows your **Cloud name**, **API Key**, and **API Secret**
   (click to reveal).
3. **Set backend env vars** (`.env` locally, Render's Environment tab in
   production): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET`. All three are required — the server validates
   them once at startup (`server/src/lib/cloudinary.js`) and refuses to
   accept traffic if any is missing, the same fail-fast pattern used for
   `ENCRYPTION_KEY`.
4. Nothing else to configure — no bucket, no CORS policy. Uploads go
   backend → Cloudinary (the browser never talks to Cloudinary directly),
   using Cloudinary's Node SDK (`cloudinary.uploader.upload_stream`) with a
   buffer already validated server-side (MIME type, extension, magic bytes,
   size cap).
5. **Folder layout** Cloudinary will show in its Media Library:
   - `nexforge/projects/<projectId>/cover-gallery/` — project cover + gallery images
   - `nexforge/projects/<projectId>/files/` — project files/documents
   - `nexforge/business/logo/` — the business logo (previous logo is
     destroyed on replace)
6. **Free tier limits**: Cloudinary's free plan is generous for a personal
   system (25 monthly credits ≈ 25GB storage/bandwidth/transformations
   combined) — plenty for project images/documents. Upgrade only if you
   outgrow it.

Optional env var: `FILE_MAX_SIZE_MB` (default `20`) caps generic project
file uploads; `IMAGE_MAX_SIZE_MB` (default `5`) caps project image and
logo uploads — both server-side hard limits, independent of whatever
Cloudinary's own plan allows.
