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

  try {
    if (req.method === 'GET') {
      const { contact_id } = req.query

      if (!contact_id) {
        return res.status(400).json({ error: 'contact_id is required' })
      }

      const activities = await sql`
        SELECT *
        FROM activities
        WHERE contact_id = ${contact_id}
        ORDER BY created_at DESC
        LIMIT 5
      `

      return res.status(200).json(activities)
    }

    if (req.method === 'POST') {
      const { contact_id, type, notes } = parseBody(req.body)

      if (!contact_id || !type || !notes) {
        return res.status(400).json({ error: 'contact_id, type, and notes are required' })
      }

      const [activity] = await sql`
        INSERT INTO activities (contact_id, type, notes)
        VALUES (${contact_id}, ${type}, ${notes})
        RETURNING *
      `

      return res.status(201).json(activity)
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('/api/activities failed', error)
    return res.status(500).json({ error: 'Failed to process activity request' })
  }
}
