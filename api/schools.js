import { getAuth } from '@clerk/backend'
import { sql } from './db.js'

function parseBody(body) {
  if (!body) {
    return {}
  }

  return typeof body === 'string' ? JSON.parse(body) : body
}

export default async function handler(req, res) {
  const { userId } = getAuth(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name, city, state } = parseBody(req.body)

    if (!name) {
      return res.status(400).json({ error: 'name is required' })
    }

    const [school] = await sql`
      INSERT INTO schools (name, city, state)
      VALUES (${name}, ${city || null}, ${state || null})
      ON CONFLICT (name) DO UPDATE
      SET city = EXCLUDED.city, state = EXCLUDED.state
      RETURNING id
    `

    return res.status(200).json(school)
  } catch (error) {
    console.error('POST /api/schools failed', error)
    return res.status(500).json({ error: 'Failed to upsert school' })
  }
}
