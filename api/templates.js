import { getUserId } from './_auth.js'
import { sql } from './_db.js'

async function readBody(req) {
  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {}
  }

  if (req.body) {
    return req.body
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks).toString('utf8')
  return body ? JSON.parse(body) : {}
}

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    const templates = await sql`
      SELECT * FROM templates
      ORDER BY created_at DESC
    `

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

    const insertedRows = await sql`
      INSERT INTO templates (name, type, body)
      VALUES (${name}, ${type}, ${body})
      RETURNING *
    `

    return res.status(201).json(insertedRows[0])
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
