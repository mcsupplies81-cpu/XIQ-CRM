import { getUserId } from './_auth.js'
import { sql } from './_db.js'

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

  const overdueFollowUps = await sql`
    SELECT contacts.id, contacts.name, contacts.follow_up_at, contacts.assigned_to, schools.name as school_name
    FROM contacts
    LEFT JOIN schools ON contacts.school_id = schools.id
    WHERE contacts.follow_up_at < CURRENT_DATE AND contacts.status != 'Closed'
    ORDER BY contacts.follow_up_at ASC
    LIMIT 5
  `

  const staleDeals = await sql`
    SELECT deals.id, deals.title, deals.stage, deals.value, deals.updated_at, schools.name as school_name
    FROM deals
    LEFT JOIN schools ON deals.school_id = schools.id
    WHERE deals.stage NOT IN ('Closed Won', 'Closed Lost')
      AND deals.updated_at < NOW() - INTERVAL '7 days'
    ORDER BY deals.updated_at ASC
    LIMIT 5
  `

  const activityTodayRows = await sql`
    SELECT
      count(*) FILTER (WHERE type = 'call')::int as calls_today,
      count(*) FILTER (WHERE type = 'dm')::int as dms_today,
      count(*) FILTER (WHERE type = 'email')::int as emails_today
    FROM activities
    WHERE created_at >= CURRENT_DATE
  `

  const pipelineByStageRows = await sql`
    SELECT
      stage,
      count(*)::int as deal_count,
      coalesce(sum(value), 0)::numeric as total_value
    FROM deals
    WHERE stage NOT IN ('Closed Won', 'Closed Lost')
    GROUP BY stage
    ORDER BY stage
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
    overdue_follow_ups: overdueFollowUps,
    stale_deals: staleDeals,
    activity_today: {
      calls_today: Number(activityTodayRows[0]?.calls_today) || 0,
      dms_today: Number(activityTodayRows[0]?.dms_today) || 0,
      emails_today: Number(activityTodayRows[0]?.emails_today) || 0,
    },
    pipeline_by_stage: pipelineByStageRows.map((row) => ({
      stage: row.stage,
      deal_count: Number(row.deal_count) || 0,
      total_value: Number(row.total_value) || 0,
    })),
  })
}
