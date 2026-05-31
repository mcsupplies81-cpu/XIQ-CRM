import { getUserId } from './_auth.js'
import { sql } from './db.js'

const contactStatuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const totalSchoolsRows = await sql`
    SELECT count(*)::int as total_schools
    FROM schools
  `

  const contactsByStatusRows = await sql`
    SELECT statuses.status, count(contacts.id)::int as count
    FROM (VALUES ('New'), ('Emailed'), ('Called'), ('Responded'), ('Closed')) as statuses(status)
    LEFT JOIN contacts ON contacts.status = statuses.status
    GROUP BY statuses.status
  `

  const dealSummaryRows = await sql`
    SELECT
      count(*)::int as total_deals,
      count(*) FILTER (WHERE stage NOT IN ('Closed Won', 'Closed Lost'))::int as open_deals
    FROM deals
  `

  const recentActivities = await sql`
    SELECT
      activities.id,
      activities.type,
      activities.notes,
      activities.created_at,
      contacts.name as contact_name,
      schools.name as school_name
    FROM activities
    LEFT JOIN contacts ON activities.contact_id = contacts.id
    LEFT JOIN schools ON contacts.school_id = schools.id
    ORDER BY activities.created_at DESC
    LIMIT 10
  `

  const contactsByStatus = contactStatuses.reduce((summary, status) => ({ ...summary, [status]: 0 }), {})

  contactsByStatusRows.forEach((row) => {
    contactsByStatus[row.status] = Number(row.count) || 0
  })

  return res.status(200).json({
    total_schools: Number(totalSchoolsRows[0]?.total_schools) || 0,
    contacts_by_status: contactsByStatus,
    total_deals: Number(dealSummaryRows[0]?.total_deals) || 0,
    open_deals: Number(dealSummaryRows[0]?.open_deals) || 0,
    recent_activities: recentActivities,
  })
}
