import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_at date`

  return res.status(200).json({ ok: true })
}
