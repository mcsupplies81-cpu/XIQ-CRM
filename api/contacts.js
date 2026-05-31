import { getAuth } from '@clerk/backend'
import { sql } from './db.js'

export default async function handler(req, res) {
  const { userId } = getAuth(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const contacts = await sql`
      SELECT contacts.*, schools.name as school_name, schools.city, schools.state
      FROM contacts
      LEFT JOIN schools ON contacts.school_id = schools.id
      ORDER BY contacts.created_at DESC
    `

    return res.status(200).json(contacts)
  } catch (error) {
    console.error('GET /api/contacts failed', error)
    return res.status(500).json({ error: 'Failed to load contacts' })
  }
}
