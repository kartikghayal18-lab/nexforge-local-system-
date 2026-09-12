// Cloudflare R2 access via the S3-compatible API. R2 keys never reach the
// frontend — only short-lived presigned URLs do.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'node:crypto'

const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']

function assertConfigured() {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`R2 is not configured — missing env vars: ${missing.join(', ')}`)
  }
}

function client() {
  assertConfigured()
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

export function buildStorageKey(projectId, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `projects/${projectId}/${crypto.randomUUID()}-${safeName}`
}

export async function presignPut(storageKey, contentType) {
  const s3 = client()
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: storageKey,
    ContentType: contentType || 'application/octet-stream',
  })
  return getSignedUrl(s3, cmd, { expiresIn: 900 }) // 15 min
}

export async function presignGet(storageKey) {
  const s3 = client()
  const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey })
  return getSignedUrl(s3, cmd, { expiresIn: 900 })
}

export async function deleteObject(storageKey) {
  const s3 = client()
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey }))
}
