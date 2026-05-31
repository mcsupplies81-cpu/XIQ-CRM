import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

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

  const { id } = req.query

  if (req.method === 'PATCH') {
    const { name, type, body } = await readBody(req)

    if (!name || !type || !body) {
      return res.status(400).json({ error: 'name, type, and body are required' })
    }

    if (!['email', 'dm'].includes(type)) {
      return res.status(400).json({ error: 'type must be email or dm' })
    }

    const updatedRows = await sql`
      UPDATE templates SET name = ${name}, type = ${type}, body = ${body}
      WHERE id = ${id}
      RETURNING *
    `

    if (updatedRows.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }

    return res.status(200).json(updatedRows[0])
  }

  if (req.method === 'DELETE') {
    const deletedRows = await sql`
      DELETE FROM templates WHERE id = ${id} RETURNING id
    `

    if (deletedRows.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }

    return res.status(200).json({ id: deletedRows[0].id })
  }

  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
