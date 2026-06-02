/**
 * Merged handler for /api/schools (POST) and /api/schools/:id (GET, PATCH)
 * Replaces api/schools.js + api/schools/[id].js to stay under
 * Vercel Hobby's 12-serverless-function limit.
 */

import { getUserId } from '../_auth.js'
import { sql } from '../_db.js'

async function readBody(req) {
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}
  if (req.body) return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.slug?.[0] || null

  // ── /api/schools/:id ─────────────────────────────────────────────────────────
  if (id) {
    if (req.method === 'GET') {
      const schools = await sql`SELECT * FROM schools WHERE id = ${id}`
      if (schools.length === 0) return res.status(404).json({ error: 'School not found' })

      const contacts = await sql`
        SELECT * FROM contacts WHERE school_id = ${id} ORDER BY created_at DESC
      `
      const deals = await sql`
        SELECT deals.*, contacts.name as contact_name
        FROM deals
        LEFT JOIN contacts ON deals.contact_id = contacts.id
        WHERE deals.school_id = ${id}
        ORDER BY deals.created_at DESC
      `
      return res.status(200).json({ school: schools[0], contacts, deals })
    }

    if (req.method === 'PATCH') {
      const { notes = '' } = await readBody(req)
      const rows = await sql`
        UPDATE schools SET notes = ${notes || ''} WHERE id = ${id} RETURNING *
      `
      if (rows.length === 0) return res.status(404).json({ error: 'School not found' })
      return res.status(200).json(rows[0])
    }

    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── /api/schools ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, city = '', state = '' } = await readBody(req)
    if (!name) return res.status(400).json({ error: 'name is required' })

    const rows = await sql`
      INSERT INTO schools (name, city, state)
      VALUES (${name}, ${city}, ${state})
      ON CONFLICT (name) DO UPDATE SET
        city  = COALESCE(EXCLUDED.city,  schools.city),
        state = COALESCE(EXCLUDED.state, schools.state)
      RETURNING id
    `
    return res.status(200).json(rows[0])
  }

  res.setHeader('Allow', 'POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
