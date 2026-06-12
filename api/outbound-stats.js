import { getUserId } from './_auth.js'
import { sql } from './_db.js'

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const [overview] = await sql`
    SELECT
      COUNT(*)                                                      AS total_queued,
      COUNT(*) FILTER (WHERE status = 'queued')                     AS queued,
      COUNT(*) FILTER (WHERE status = 'active')                     AS active,
      COUNT(*) FILTER (WHERE status = 'completed')                  AS completed,
      COUNT(*) FILTER (WHERE status = 'replied')                    AS replied,
      COUNT(*) FILTER (WHERE status = 'bounced')                    AS bounced,
      COUNT(*) FILTER (WHERE status = 'unsubscribed')               AS unsubscribed
    FROM outbound_sequences
  `

  const emailStats = await sql`
    SELECT
      COUNT(*)                                                      AS total_sent,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)                 AS total_opened,
      COUNT(DISTINCT contact_id) FILTER (WHERE opened_at IS NOT NULL) AS unique_openers,
      ROUND(
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )                                                             AS open_rate_pct,
      COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)                AS bounced,
      ROUND(
        COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )                                                             AS bounce_rate_pct
    FROM outbound_emails
    WHERE sent_at IS NOT NULL
  `

  const byStep = await sql`
    SELECT
      step,
      COUNT(*)                                                      AS sent,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)                 AS opened,
      ROUND(
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )                                                             AS open_rate_pct
    FROM outbound_emails
    WHERE sent_at IS NOT NULL
    GROUP BY step
    ORDER BY step
  `

  const topSubjects = await sql`
    SELECT
      subject,
      COUNT(*)                                                      AS sent,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)                 AS opened,
      ROUND(
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
      )                                                             AS open_rate_pct
    FROM outbound_emails
    WHERE sent_at IS NOT NULL
    GROUP BY subject
    HAVING COUNT(*) >= 3
    ORDER BY open_rate_pct DESC NULLS LAST
    LIMIT 10
  `

  const recentSends = await sql`
    SELECT
      oe.id,
      oe.step,
      oe.subject,
      oe.from_email,
      oe.sent_at,
      oe.opened_at,
      oe.open_count,
      c.name  AS contact_name,
      c.role  AS contact_role,
      s.name  AS school_name,
      s.state AS school_state
    FROM outbound_emails oe
    JOIN contacts c ON c.id = oe.contact_id
    JOIN schools  s ON s.id = c.school_id
    WHERE oe.sent_at IS NOT NULL
    ORDER BY oe.sent_at DESC
    LIMIT 25
  `

  const replyStats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'replied') AS total_replies,
      ROUND(
        COUNT(*) FILTER (WHERE status = 'replied')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE status IN ('active','completed','replied')), 0) * 100, 1
      ) AS reply_rate_pct
    FROM outbound_sequences
  `

  res.status(200).json({
    overview,
    email_stats: emailStats[0],
    by_step: byStep,
    top_subjects: topSubjects,
    recent_sends: recentSends,
    reply_stats: replyStats[0],
  })
}
