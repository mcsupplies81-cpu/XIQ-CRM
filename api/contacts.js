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

  if (req.method === 'GET') {
    const contacts = await sql`
      SELECT
        contacts.*,
        schools.name as school_name,
        schools.city,
        schools.state,
        (SELECT MAX(a.created_at) FROM activities a WHERE a.contact_id = contacts.id) as last_contacted_at,
        (SELECT COUNT(*)::int FROM activities a WHERE a.contact_id = contacts.id AND a.type = 'call') as call_count
      FROM contacts
      LEFT JOIN schools ON contacts.school_id = schools.id
      ORDER BY contacts.created_at DESC
    `

    return res.status(200).json(contacts)
  }

  if (req.method === 'POST') {
    const {
      name,
      school_name,
      role = '',
      email = '',
      phone = '',
      x_handle = '',
      assigned_to = null,
      status = 'New',
      notes = '',
    } = await readBody(req)
    const cleanName = cleanValue(name)
    const cleanSchoolName = cleanValue(school_name)
    let schoolId = null

    if (!cleanName) {
      return res.status(400).json({ error: 'name is required' })
    }

    if (cleanSchoolName) {
      const schoolRows = await sql`
        SELECT id
        FROM schools
        WHERE lower(name) = lower(${cleanSchoolName})
        LIMIT 1
      `

      if (schoolRows.length > 0) {
        schoolId = schoolRows[0].id
      } else {
        const insertedSchoolRows = await sql`
          INSERT INTO schools (name, city, state)
          VALUES (${cleanSchoolName}, '', '')
          RETURNING id
        `
        schoolId = insertedSchoolRows[0].id
      }
    }

    const insertedRows = await sql`
      INSERT INTO contacts (name, school_id, role, email, phone, x_handle, status, assigned_to, notes)
      VALUES (
        ${cleanName},
        ${schoolId},
        ${cleanValue(role) || null},
        ${cleanValue(email) || null},
        ${cleanValue(phone)},
        ${cleanValue(x_handle)},
        ${cleanValue(status) || 'New'},
        ${cleanValue(assigned_to) || null},
        ${cleanValue(notes)}
      )
      RETURNING *
    `

    const contactRows = await sql`
      SELECT contacts.*, schools.name as school_name, schools.city, schools.state
      FROM contacts
      LEFT JOIN schools ON contacts.school_id = schools.id
      WHERE contacts.id = ${insertedRows[0].id}
    `

    return res.status(201).json(contactRows[0])
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
