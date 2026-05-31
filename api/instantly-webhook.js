/**
 * Instantly → CRM webhook
 *
 * Configure in Instantly: Settings → Webhooks → URL: https://xiq-crm.vercel.app/api/instantly-webhook
 * Events to enable: email_sent, lead_replied, lead_bounced
 *
 * Set INSTANTLY_WEBHOOK_SECRET in Vercel env vars (copy from Instantly webhook settings).
 * Leave it unset in dev to skip verification.
 */

import { sql } from './_db.js'

async function readBody(req) {
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}
  if (req.body) return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify secret — skip check if env var not set (local dev)
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET
  if (secret) {
    const provided =
      req.headers['x-webhook-secret'] ||
      req.headers['x-instantly-secret'] ||
      req.headers['x-instantly-webhook-secret']
    if (provided !== secret) {
      return res.status(401).json({ error: 'Invalid webhook secret' })
    }
  }

  const payload = await readBody(req)

  // Instantly sends event_type at the top level
  const eventType = payload.event_type || payload.type || ''
  const leadEmail = (payload.lead?.email || payload.email || '').toLowerCase().trim()

  // Always return 200 so Instantly doesn't retry — just log ignored events
  if (!leadEmail) {
    return res.status(200).json({ status: 'ignored', reason: 'no lead email' })
  }

  // Ignore open/click events — too noisy (150 emails/day)
  if (eventType === 'lead_opened' || eventType === 'lead_clicked') {
    return res.status(200).json({ status: 'ignored', reason: eventType })
  }

  // Look up contact by email
  const rows = await sql`
    SELECT id, status FROM contacts WHERE lower(email) = ${leadEmail} LIMIT 1
  `

  if (rows.length === 0) {
    return res.status(200).json({ status: 'ignored', reason: 'contact not found', email: leadEmail })
  }

  const contact = rows[0]
  const campaign = payload.campaign_name || ''

  let activityNotes = ''
  let newStatus = null

  if (eventType === 'lead_replied' || eventType === 'reply_received') {
    // Coach replied — most important event
    const subject = payload.reply_subject || payload.subject || ''
    const preview = (payload.reply_text || payload.body_preview || '').slice(0, 200)
    activityNotes = [
      subject ? `Re: ${subject}` : 'Coach replied',
      preview || null,
      campaign ? `[${campaign}]` : null,
    ].filter(Boolean).join(' — ')

    // Bump status to Responded unless already there or closed
    if (!['Responded', 'Closed'].includes(contact.status)) {
      newStatus = 'Responded'
    }
  } else if (eventType === 'email_sent' || eventType === 'lead_sent' || eventType === 'lead_emailed') {
    // Email sent to coach
    const subject = payload.subject || payload.email_subject || ''
    activityNotes = [
      subject ? `Sent: ${subject}` : 'Email sent via Instantly',
      campaign ? `[${campaign}]` : null,
    ].filter(Boolean).join(' ')

    // Only advance from New → Emailed (don't downgrade if already further along)
    if (contact.status === 'New') {
      newStatus = 'Emailed'
    }
  } else if (eventType === 'lead_bounced') {
    activityNotes = `Email bounced${campaign ? ` [${campaign}]` : ''}`
  } else {
    // Catch-all — log it but don't crash
    activityNotes = `Instantly: ${eventType}${campaign ? ` [${campaign}]` : ''}`
  }

  // Log the activity
  await sql`
    INSERT INTO activities (contact_id, type, notes, created_by)
    VALUES (${contact.id}, 'email', ${activityNotes}, 'Instantly')
  `

  // Update contact status if needed
  if (newStatus) {
    await sql`UPDATE contacts SET status = ${newStatus} WHERE id = ${contact.id}`
  }

  return res.status(200).json({
    status: 'ok',
    contact_id: contact.id,
    event: eventType,
    activity: activityNotes,
    status_updated: newStatus,
  })
}
