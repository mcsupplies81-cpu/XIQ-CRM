// Reply detector — polls Gmail for replies to outbound threads
// Classifies replies, drafts responses, fires Slack alerts

require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const { sql } = require('../lib/db.cjs')
const { getNewReplies, markRead } = require('../lib/gmail.cjs')
const { notifyReply, notifyPositiveReply } = require('../lib/slack.cjs')

const client = new Anthropic.default()
const INBOXES = (process.env.OUTBOUND_INBOXES || '').split(',').map(e => e.trim()).filter(Boolean)

const POSITIVE_SIGNALS = [
  'interested', 'tell me more', 'sounds good', 'let\'s talk', 'let\'s connect',
  'schedule', 'calendar', 'set up', 'demo', 'yes', 'when are you', 'available',
  'book', 'call', 'meeting', 'forward this', 'pass this along',
]

const NEGATIVE_SIGNALS = [
  'not interested', 'remove me', 'unsubscribe', 'stop emailing', 'do not contact',
  'no thanks', 'not a fit', 'we already have', 'not in the budget',
]

function classifyReply(snippet) {
  const lower = snippet.toLowerCase()
  if (NEGATIVE_SIGNALS.some(s => lower.includes(s))) return 'negative'
  if (POSITIVE_SIGNALS.some(s => lower.includes(s))) return 'positive'
  return 'neutral'
}

async function draftReply(contactName, school, replySnippet) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Draft a short reply from Cameron at XIQ to ${contactName} at ${school}.
Their reply: "${replySnippet}"
Rules: No em dashes. No fluff. Answer their question first if they asked one. Under 80 words. Sign off: Cameron / XIQ
Just the reply body, no subject line.`,
    }],
  })
  return msg.content[0].text.trim()
}

async function handleUnsubscribe(email) {
  await sql`INSERT INTO unsubscribes (email) VALUES (${email}) ON CONFLICT DO NOTHING`
  await sql`
    UPDATE outbound_sequences os
    SET status = 'unsubscribed', updated_at = now()
    FROM contacts c
    WHERE c.id = os.contact_id AND c.email = ${email}
  `
}

async function runReplyDetector() {
  console.log('Reply detector running...')
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24h

  for (const inbox of INBOXES) {
    console.log(`Checking ${inbox}...`)
    let replies
    try {
      replies = await getNewReplies(inbox, since)
    } catch (err) {
      console.error(`  Error checking ${inbox}:`, err.message)
      continue
    }

    for (const reply of replies) {
      // Match to a sequence by thread ID
      const seqs = await sql`
        SELECT os.*, c.name as contact_name, c.email as contact_email, s.name as school_name
        FROM outbound_sequences os
        JOIN contacts c ON c.id = os.contact_id
        JOIN schools s ON s.id = c.school_id
        WHERE os.gmail_thread_id = ${reply.threadId}
        LIMIT 1
      `

      if (!seqs.length) continue // not our thread
      const seq = seqs[0]

      const classification = classifyReply(reply.snippet)
      console.log(`  Reply from ${reply.from}: ${classification}`)

      // Handle unsubscribe
      if (classification === 'negative' && NEGATIVE_SIGNALS.some(s => reply.snippet.toLowerCase().includes(s) && s.includes('unsubscribe' || 'remove'))) {
        await handleUnsubscribe(seq.contact_email)
      }

      // Update sequence status
      if (classification === 'positive' || classification === 'neutral') {
        await sql`UPDATE outbound_sequences SET status = 'replied', updated_at = now() WHERE id = ${seq.id}`
        await sql`
          INSERT INTO activities (contact_id, type, notes)
          VALUES (${seq.contact_id}, 'email', ${`Reply received: "${reply.snippet.slice(0, 200)}"`})
        `
      }

      // Draft a suggested reply
      const draft = await draftReply(seq.contact_name, seq.school_name, reply.snippet)

      if (classification === 'positive') {
        await notifyPositiveReply({
          from: reply.from,
          name: seq.contact_name,
          school: seq.school_name,
          subject: reply.subject,
          snippet: reply.snippet,
          draftReply: draft,
        })
      } else if (classification === 'neutral') {
        await notifyReply({
          from: reply.from,
          name: seq.contact_name,
          school: seq.school_name,
          subject: reply.subject,
          snippet: reply.snippet,
          draftReply: draft,
        })
      }

      await markRead(inbox, reply.id)
    }
  }

  console.log('Reply check done.')
}

runReplyDetector().catch(e => { console.error(e); process.exit(1) })
