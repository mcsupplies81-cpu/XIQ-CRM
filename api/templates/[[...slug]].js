/**
 * Merged handler for /api/templates and /api/templates/:id
 * Replaces api/templates.js + api/templates/[id].js to stay under
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

  // slug is undefined for /api/templates, ['id'] for /api/templates/:id
  const id = req.query.slug?.[0] || null

  // ── /api/templates/:id ───────────────────────────────────────────────────────
  if (id) {
    if (req.method === 'PATCH') {
      const { name, type, body } = await readBody(req)
      if (!name || !type || !body) {
        return res.status(400).json({ error: 'name, type, and body are required' })
      }
      if (!['email', 'dm'].includes(type)) {
        return res.status(400).json({ error: 'type must be email or dm' })
      }
      const rows = await sql`
        UPDATE templates SET name = ${name}, type = ${type}, body = ${body}
        WHERE id = ${id} RETURNING *
      `
      if (rows.length === 0) return res.status(404).json({ error: 'Template not found' })
      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      const rows = await sql`DELETE FROM templates WHERE id = ${id} RETURNING id`
      if (rows.length === 0) return res.status(404).json({ error: 'Template not found' })
      return res.status(200).json({ id: rows[0].id })
    }

    res.setHeader('Allow', 'PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── /api/templates ───────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const templates = await sql`SELECT * FROM templates ORDER BY created_at DESC`
    return res.status(200).json(templates)
  }

  if (req.method === 'POST') {
    const { name, type, body } = await readBody(req)
    if (!name || !type || !body) {
      return res.status(400).json({ error: 'name, type, and body are required' })
    }
    if (!['email', 'dm'].includes(type)) {
      return res.status(400).json({ error: 'type must be email or dm' })
    }
    const rows = await sql`
      INSERT INTO templates (name, type, body) VALUES (${name}, ${type}, ${body}) RETURNING *
    `
    return res.status(201).json(rows[0])
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
