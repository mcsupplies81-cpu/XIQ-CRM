import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  await sql`
    ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS probability integer DEFAULT 50 CHECK (probability >= 0 AND probability <= 100)
  `

  return res.status(200).json({ ok: true })
}
