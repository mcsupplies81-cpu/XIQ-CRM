import { getAuth } from '@clerk/backend'
import { sql } from './db.js'

function parseBody(body) {
  if (!body) {
    return {}
  }

  return typeof body === 'string' ? JSON.parse(body) : body
}

async function upsertSchool(row) {
  if (!row.school_name) {
    return null
  }

  const [school] = await sql`
    INSERT INTO schools (name, city, state)
    VALUES (${row.school_name}, ${row.city || null}, ${row.state || null})
    ON CONFLICT (name) DO UPDATE
    SET city = EXCLUDED.city, state = EXCLUDED.state
    RETURNING id
  `

  return school.id
}

async function insertContact(row, schoolId) {
  if (!row.email) {
    throw new Error('email is required to skip duplicates')
  }

  const [contact] = await sql`
    INSERT INTO contacts (name, school_id, role, email, phone, x_handle)
    VALUES (
      ${row.name || null},
      ${schoolId},
      ${row.role || null},
      ${row.email},
      ${row.phone || null},
      ${row.x_handle || null}
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `

  return contact
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
    const { rows } = parseBody(req.body)

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows must be an array' })
    }

    const result = {
      imported: 0,
      skipped: 0,
      errors: [],
    }

    for (const [index, row] of rows.entries()) {
      try {
        const schoolId = await upsertSchool(row)
        const contact = await insertContact(row, schoolId)

        if (contact) {
          result.imported += 1
        } else {
          result.skipped += 1
        }
      } catch (error) {
        result.errors.push({ row: index, message: error.message })
      }
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('POST /api/import failed', error)
    return res.status(500).json({ error: 'Failed to import contacts' })
  }
}
