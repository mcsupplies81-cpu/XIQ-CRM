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

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, city = '', state = '' } = await readBody(req)

  if (!name) {
    return res.status(400).json({ error: 'name is required' })
  }

  const insertedRows = await sql`
    INSERT INTO schools (name, city, state)
    VALUES (${name}, ${city}, ${state})
    ON CONFLICT (name) DO UPDATE SET
      city = EXCLUDED.city,
      state = EXCLUDED.state
    RETURNING id
  `

  return res.status(200).json(insertedRows[0])
}
