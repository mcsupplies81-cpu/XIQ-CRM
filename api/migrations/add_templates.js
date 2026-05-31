import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await sql`
    CREATE TABLE IF NOT EXISTS templates (
      id uuid default gen_random_uuid() primary key,
      name text not null,
      type text check (type in ('email', 'dm')) not null,
      body text not null,
      created_at timestamp default now()
    )
  `

  return res.status(200).json({ ok: true })
}
