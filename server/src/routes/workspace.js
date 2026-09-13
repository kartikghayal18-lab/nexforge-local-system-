import { Router } from 'express'
import { pool } from '../db/pool.js'
import { deleteImage } from '../lib/storage/index.js'
import { deleteObject as deleteR2Object } from '../lib/r2.js'
import { deleteAllWorkspaceData, collectLocalImageStorageKeys } from '../lib/workspaceReset.js'

const router = Router()

router.post('/reset', async (req, res) => {
  const client = await pool.connect()
  let localImageKeys = []
  let r2FileKeys = []
  try {
    await client.query('BEGIN')
    localImageKeys = await collectLocalImageStorageKeys(client)
    r2FileKeys = (await client.query("SELECT storage_key FROM project_files WHERE storage_key IS NOT NULL AND storage_key <> ''")).rows.map((r) => r.storage_key)
    await deleteAllWorkspaceData(client)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Best-effort file cleanup AFTER the DB transaction has committed — file
  // I/O is deliberately not part of the transaction (see
  // server/src/lib/workspaceReset.js). A failure here is logged only; the
  // DB-level reset the owner asked for has already succeeded regardless.
  const fileErrors = []
  for (const key of localImageKeys) {
    try { await deleteImage(key) } catch (err) { fileErrors.push(key); console.error('[workspace] failed to delete local image', key, err) }
  }
  for (const key of r2FileKeys) {
    try { await deleteR2Object(key) } catch (err) { fileErrors.push(key); console.error('[workspace] failed to delete R2 file', key, err) }
  }

  res.json({ ok: true, filesDeleted: localImageKeys.length + r2FileKeys.length - fileErrors.length, fileErrors: fileErrors.length })
})

export default router
