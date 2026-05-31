import { getUserId, getUserDisplayName } from './_auth.js'
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
    const { contact_id, today } = req.query

    if (today) {
      const rows = await sql`
        SELECT contact_id, type
        FROM activities
        WHERE created_at >= CURRENT_DATE AND type IN ('dm', 'call')
      `
      const contactIdsDmedToday = new Set()
      let dmCount = 0
      let callCount = 0
      rows.forEach((row) => {
        if (row.type === 'dm') { dmCount += 1; contactIdsDmedToday.add(String(row.contact_id)) }
        if (row.type === 'call') callCount += 1
      })
      return res.status(200).json({ dm_count: dmCount, call_count: callCount, contact_ids_dmed_today: Array.from(contactIdsDmedToday) })
    }

    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id is required' })
    }

    const activities = await sql`
      SELECT * FROM activities
      WHERE contact_id = ${contact_id}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return res.status(200).json(activities)
  }

  if (req.method === 'POST') {
    const { contact_id, type, notes = '' } = await readBody(req)

    if (!contact_id || !type) {
      return res.status(400).json({ error: 'contact_id and type are required' })
    }

    const createdBy = await getUserDisplayName(userId)

    const insertedRows = await sql`
      INSERT INTO activities (contact_id, type, notes, created_by)
      VALUES (${contact_id}, ${type}, ${notes}, ${createdBy})
      RETURNING *
    `

    return res.status(201).json(insertedRows[0])
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
