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

function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : value || ''
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

  const { rows = [] } = await readBody(req)

  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows must be an array' })
  }

  let imported = 0
  let skipped = 0
  const errors = []

  for (const [index, row] of rows.entries()) {
    try {
      const name = cleanValue(row.name)
      const schoolName = cleanValue(row.school_name)
      const city = cleanValue(row.city)
      const state = cleanValue(row.state)
      const role = cleanValue(row.role)
      const email = cleanValue(row.email)
      const phone = cleanValue(row.phone)
      const xHandle = cleanValue(row.x_handle)

      if (!name || !schoolName || !email) {
        skipped += 1
        errors.push({ row: index + 1, error: 'name, school_name, and email are required' })
        continue
      }

      const schoolRows = await sql`
        INSERT INTO schools (name, city, state)
        VALUES (${schoolName}, ${city || null}, ${state || null})
        ON CONFLICT (name) DO UPDATE SET
          city  = COALESCE(EXCLUDED.city,  schools.city),
          state = COALESCE(EXCLUDED.state, schools.state)
        RETURNING id
      `

      const contactRows = await sql`
        INSERT INTO contacts (name, school_id, role, email, phone, x_handle, status, assigned_to, notes)
        VALUES (${name}, ${schoolRows[0].id}, ${role}, ${email}, ${phone}, ${xHandle}, 'New', NULL, '')
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `

      if (contactRows.length === 0) {
        skipped += 1
      } else {
        imported += 1
      }
    } catch (error) {
      skipped += 1
      errors.push({ row: index + 1, error: error.message })
    }
  }

  return res.status(200).json({ imported, skipped, errors })
}
