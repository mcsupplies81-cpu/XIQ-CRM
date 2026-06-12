// Daily send pipeline — runs on a schedule (weekday mornings)
// Pulls contacts due today, writes emails, validates, sends via Gmail API, logs to DB

require('dotenv').config()
const { sql } = require('../lib/db.cjs')
const { getResearch } = require('./research.cjs')
const { generateEmail } = require('./copy-engine.cjs')
const { sendEmail } = require('../lib/gmail.cjs')
const { notifySent, notifyBounce, dailyDigest } = require('../lib/slack.cjs')

// Rotate across inboxes — round-robin by sequence ID
const INBOXES = (process.env.OUTBOUND_INBOXES || '').split(',').map(e => e.trim()).filter(Boolean)
const BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://xiq-crm.vercel.app'
const { randomUUID } = require('crypto')

function pickInbox(sequenceId) {
  // Simple hash of UUID last char for distribution
  const n = parseInt(sequenceId.slice(-4), 16)
  return INBOXES[n % INBOXES.length]
}

// Sequence timing: day 1, day 4, day 9
const STEP_DELAYS = [0, 3, 5] // days after previous send

async function runDailySend() {
  if (INBOXES.length === 0) {
    console.error('OUTBOUND_INBOXES not set')
    process.exit(1)
  }

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  console.log(`\nXIQ Outbound — ${today}`)
  console.log(`Inboxes: ${INBOXES.join(', ')}\n`)

  // Check unsubscribe + bounce guard
  const [{ count: unsub }] = await sql`SELECT COUNT(*) FROM unsubscribes`
  console.log(`Unsubscribes on file: ${unsub}`)

  // Pull sequences due today
  const due = await sql`
    SELECT
      os.*,
      c.name as contact_name,
      c.email as contact_email,
      c.role as contact_role,
      s.name as school_name,
      s.state as school_state,
      s.level as school_level,
      s.notes as school_notes,
      s.maxpreps_url as school_maxpreps_url
    FROM outbound_sequences os
    JOIN contacts c ON c.id = os.contact_id
    JOIN schools s ON s.id = c.school_id
    WHERE os.status IN ('queued', 'active')
      AND os.next_send_at IS NOT NULL
      AND os.next_send_at::date <= ${today}
      AND c.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM unsubscribes u WHERE u.email = c.email
      )
    ORDER BY os.next_send_at ASC
    LIMIT 75
  `

  console.log(`Due to send: ${due.length}\n`)

  let sent = 0
  let quarantined = 0
  let bounced = 0

  for (const seq of due) {
    const contact = {
      id: seq.contact_id,
      name: seq.contact_name,
      email: seq.contact_email,
      role: seq.contact_role,
    }
    const school = {
      name: seq.school_name,
      state: seq.school_state,
      level: seq.school_level,
      notes: seq.school_notes,
      maxpreps_url: seq.school_maxpreps_url,
    }

    console.log(`${contact.name} (${school.name}) — step ${seq.step}`)

    // Get or reuse cached research
    let research = seq.research
    if (!research) {
      process.stdout.write('  Researching...')
      research = await getResearch(contact, school)
      process.stdout.write(' done\n')
    }

    // Generate email
    process.stdout.write('  Writing...')
    const email = await generateEmail(seq.step, research, contact, school)

    if (!email) {
      process.stdout.write(' QUARANTINED\n')
      await sql`UPDATE outbound_sequences SET status = 'paused', updated_at = now() WHERE id = ${seq.id}`
      quarantined++
      continue
    }
    process.stdout.write(` done (attempt ${email.attempt})\n`)

    // Send via Gmail
    const fromEmail = seq.from_email || pickInbox(seq.id)
    const emailId = randomUUID()
    const trackingPixelUrl = `${BASE_URL}/api/outbound?track=1&id=${emailId}`
    let gmailResult
    try {
      gmailResult = await sendEmail({
        from: fromEmail,
        to: contact.email,
        subject: email.subject,
        body: email.body,
        trackingPixelUrl,
      })
    } catch (err) {
      if (err.message?.includes('550') || err.message?.includes('bounce') || err.message?.includes('invalid')) {
        console.log('  BOUNCE — clearing email in CRM')
        await sql`UPDATE contacts SET email = NULL WHERE id = ${contact.id}`
        await sql`UPDATE outbound_sequences SET status = 'bounced', updated_at = now() WHERE id = ${seq.id}`
        await notifyBounce({ to: contact.email, name: contact.name, school: school.name })
        bounced++
        continue
      }
      console.error('  Send error:', err.message)
      continue
    }

    // Log to DB
    const nextStep = seq.step + 1
    const hasMoreSteps = nextStep < 3
    const nextDelay = STEP_DELAYS[nextStep]
    const nextSend = hasMoreSteps ? new Date(Date.now() + nextDelay * 24 * 60 * 60 * 1000).toISOString() : null

    await sql`
      INSERT INTO outbound_emails (id, sequence_id, contact_id, step, subject, body, from_email, gmail_message_id, gmail_thread_id, sent_at)
      VALUES (${emailId}, ${seq.id}, ${contact.id}, ${seq.step}, ${email.subject}, ${email.body}, ${fromEmail}, ${gmailResult.id}, ${gmailResult.threadId}, now())
    `

    await sql`
      UPDATE outbound_sequences SET
        step         = ${nextStep},
        status       = ${hasMoreSteps ? 'active' : 'completed'},
        next_send_at = ${nextSend},
        from_email   = ${fromEmail},
        research     = ${JSON.stringify(research)},
        gmail_thread_id = ${gmailResult.threadId},
        updated_at   = now()
      WHERE id = ${seq.id}
    `

    // Also log as CRM activity
    await sql`
      INSERT INTO activities (contact_id, type, notes)
      VALUES (${contact.id}, 'email', ${`Outbound email ${seq.step + 1}/3 sent: "${email.subject}"`})
    `

    await notifySent({
      to: contact.email,
      name: contact.name,
      school: school.name,
      step: seq.step + 1,
      subject: email.subject,
      fromEmail,
    })

    sent++
    console.log(`  Sent from ${fromEmail} — "${email.subject}"`)

    // Small delay between sends
    await new Promise(r => setTimeout(r, 2000))
  }

  // Daily digest
  const replies = await sql`SELECT COUNT(*) FROM outbound_sequences WHERE status = 'replied' AND updated_at::date = ${today}`
  await dailyDigest({
    sent,
    replies: Number(replies[0].count),
    positives: 0,
    bounces: bounced,
    date: today,
  })

  console.log(`\nDone. Sent: ${sent} | Quarantined: ${quarantined} | Bounced: ${bounced}`)
}

runDailySend().catch(e => { console.error(e); process.exit(1) })
