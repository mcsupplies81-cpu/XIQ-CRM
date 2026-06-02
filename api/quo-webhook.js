/**
 * Quo (OpenPhone) webhook handler
 * Receives call.completed events, auto-logs activities, advances call sequence.
 *
 * Outbound no-contact (no-answer / busy / failed):
 *   - Logs "No Answer (attempt N)"
 *   - Schedules follow-up per SEQUENCE_DAYS
 *   - Auto-closes contact after 5 no-contact attempts
 *
 * Outbound connected (status=completed, duration >= 20s):
 *   - Logs "Call connected (X min) — update outcome in CRM"
 *   - Malcolm picks the real outcome (Appointment Set, etc.) in the CRM
 *
 * Always returns 200 so Quo doesn't retry.
 */

import crypto from 'crypto'
import { sql } from './_db.js'

const SEQUENCE_DAYS = [2, 3, 4, 5] // days until next follow-up for attempts 1→2, 2→3, 3→4, 4→5

function normalizePhone(phone) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-10) // last 10 digits
}

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return !secret // skip if no secret configured
  try {
    // Header format: "t=<timestamp>,v1=<hmac_hex>"
    const parts = {}
    for (const part of signatureHeader.split(',')) {
      const idx = part.indexOf('=')
      parts[part.slice(0, idx)] = part.slice(idx + 1)
    }
    if (!parts.t || !parts.v1) return false
    const payload = `${parts.t}.${rawBody}`
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const actualBuf = Buffer.from(parts.v1, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (actualBuf.length !== expectedBuf.length) return false
    return crypto.timingSafeEqual(actualBuf, expectedBuf)
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Read raw body before any parsing
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const rawBody = Buffer.concat(chunks).toString('utf8')

  // Verify Quo signature
  const secret = process.env.QUO_WEBHOOK_SECRET
  const sig = req.headers['openphone-signature']
  if (!verifySignature(rawBody, sig, secret)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return res.status(200).json({ ok: true, skipped: 'invalid JSON' })
  }

  const { type, data } = payload
  const call = data?.object

  // Only process outbound call completions
  if (type !== 'call.completed') {
    return res.status(200).json({ ok: true, skipped: `event type: ${type}` })
  }
  if (call?.direction !== 'outbound') {
    return res.status(200).json({ ok: true, skipped: 'inbound call' })
  }

  const toPhone = normalizePhone(call.to)
  if (!toPhone) return res.status(200).json({ ok: true, skipped: 'no phone' })

  // Match contact by last 10 digits of phone number
  const contacts = await sql`
    SELECT * FROM contacts
    WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${toPhone}
    LIMIT 1
  `
  if (contacts.length === 0) {
    return res.status(200).json({ ok: true, skipped: 'contact not found' })
  }

  const contact = contacts[0]
  const callStatus = call.status // 'no-answer' | 'busy' | 'failed' | 'completed'
  const duration = call.duration || 0
  const isNoContact = ['no-answer', 'busy', 'failed'].includes(callStatus)
    || (callStatus === 'completed' && duration < 20)
  const currentCallCount = contact.call_count || 0
  const newCallCount = currentCallCount + 1

  if (isNoContact) {
    const isAutoClose = newCallCount >= 5

    if (isAutoClose) {
      await sql`
        INSERT INTO activities (contact_id, type, notes)
        VALUES (${contact.id}, 'call', 'No Answer — auto-closed after 5 no-contact attempts')
      `
      await sql`
        UPDATE contacts
        SET status = 'Closed', call_count = ${newCallCount}, follow_up_at = NULL
        WHERE id = ${contact.id}
      `
    } else {
      const daysOut = SEQUENCE_DAYS[currentCallCount] ?? 5
      await sql`
        INSERT INTO activities (contact_id, type, notes)
        VALUES (${contact.id}, 'call', ${'No Answer (attempt ' + newCallCount + ')'})
      `
      await sql`
        UPDATE contacts
        SET call_count = ${newCallCount},
            follow_up_at = NOW() + make_interval(days => ${daysOut})
        WHERE id = ${contact.id}
      `
    }
  } else {
    // Connected call — log it, Malcolm updates the outcome in the CRM
    const mins = Math.max(1, Math.round(duration / 60))
    await sql`
      INSERT INTO activities (contact_id, type, notes)
      VALUES (${contact.id}, 'call', ${'Call connected (' + mins + ' min) — update outcome in CRM'})
    `
  }

  return res.status(200).json({ ok: true })
}
