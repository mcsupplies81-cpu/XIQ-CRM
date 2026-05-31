import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const activities = await sql`
    SELECT contact_id, type
    FROM activities
    WHERE created_at >= CURRENT_DATE
      AND type IN ('dm', 'call')
  `

  const contactIdsDmedToday = new Set()
  let dmCount = 0
  let callCount = 0

  activities.forEach((activity) => {
    if (activity.type === 'dm') {
      dmCount += 1
      contactIdsDmedToday.add(String(activity.contact_id))
    }

    if (activity.type === 'call') {
      callCount += 1
    }
  })

  return res.status(200).json({
    dm_count: dmCount,
    call_count: callCount,
    contact_ids_dmed_today: Array.from(contactIdsDmedToday),
  })
}
