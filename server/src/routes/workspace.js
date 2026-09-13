import { Router } from 'express'
import { pool } from '../db/pool.js'
import { deleteImage } from '../lib/storage/index.js'
import { destroyAsset } from '../lib/cloudinary.js'
import { deleteAllWorkspaceData, collectLocalImageStorageKeys, collectProjectFileAssets } from '../lib/workspaceReset.js'

const router = Router()

router.post('/reset', async (req, res) => {
  const client = await pool.connect()
  let localImageKeys = []
  let fileAssets = []
  try {
    await client.query('BEGIN')
    localImageKeys = await collectLocalImageStorageKeys(client)
    fileAssets = await collectProjectFileAssets(client)
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
    try { await deleteImage(key) } catch (err) { fileErrors.push(key); console.error('[workspace] failed to delete image', key, err) }
  }
  for (const asset of fileAssets) {
    try { await destroyAsset(asset.publicId, asset.resourceType) } catch (err) { fileErrors.push(asset.publicId); console.error('[workspace] failed to delete file asset', asset.publicId, err) }
  }

  res.json({ ok: true, filesDeleted: localImageKeys.length + fileAssets.length - fileErrors.length, fileErrors: fileErrors.length })
})

export default router
