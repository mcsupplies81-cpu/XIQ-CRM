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

  if (req.method === 'GET') {
    const dealRows = await sql`
      SELECT deals.*, schools.name as school_name, contacts.name as contact_name
      FROM deals
      LEFT JOIN schools ON deals.school_id = schools.id
      LEFT JOIN contacts ON deals.contact_id = contacts.id
      WHERE deals.id = ${id}
    `

    if (dealRows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' })
    }

    return res.status(200).json(dealRows[0])
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req)
    const hasStage = Object.prototype.hasOwnProperty.call(body, 'stage')
    const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title')
    const hasValue = Object.prototype.hasOwnProperty.call(body, 'value')
    const hasCloseDate = Object.prototype.hasOwnProperty.call(body, 'close_date')
    const hasNotes = Object.prototype.hasOwnProperty.call(body, 'notes')
    const hasProbability = Object.prototype.hasOwnProperty.call(body, 'probability')
    const hasNextAction = Object.prototype.hasOwnProperty.call(body, 'next_action')

    if (!hasStage && !hasTitle && !hasValue && !hasCloseDate && !hasNotes && !hasProbability && !hasNextAction) {
      return res.status(400).json({ error: 'No fields provided' })
    }

    const updatedRows = await sql`
      UPDATE deals
      SET
        stage = CASE WHEN ${hasStage} THEN ${hasStage ? body.stage : null} ELSE stage END,
        title = CASE WHEN ${hasTitle} THEN ${hasTitle ? body.title : null} ELSE title END,
        value = CASE WHEN ${hasValue} THEN ${hasValue && body.value !== '' ? body.value : null} ELSE value END,
        close_date = CASE WHEN ${hasCloseDate} THEN ${hasCloseDate && body.close_date ? body.close_date : null} ELSE close_date END,
        notes = CASE WHEN ${hasNotes} THEN ${hasNotes ? body.notes : null} ELSE notes END,
        probability = CASE WHEN ${hasProbability} THEN ${hasProbability && body.probability !== '' ? body.probability : null} ELSE probability END,
        next_action = CASE WHEN ${hasNextAction} THEN ${hasNextAction ? body.next_action || null : null} ELSE next_action END
      WHERE id = ${id}
      RETURNING *
    `

    if (updatedRows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' })
    }

    return res.status(200).json(updatedRows[0])
  }

  if (req.method === 'DELETE') {
    const deletedRows = await sql`
      DELETE FROM deals
      WHERE id = ${id}
      RETURNING id
    `

    if (deletedRows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' })
    }

    return res.status(200).json({ id: deletedRows[0].id })
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
