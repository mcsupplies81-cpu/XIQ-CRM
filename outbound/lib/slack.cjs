// Slack webhook helpers for the outbound pipeline

const WEBHOOK = process.env.SLACK_OUTBOUND_WEBHOOK

async function post(blocks) {
  if (!WEBHOOK) return
  await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })
}

function text(str) {
  return { type: 'section', text: { type: 'mrkdwn', text: str } }
}

function divider() {
  return { type: 'divider' }
}

async function notifySent({ to, name, school, step, subject, fromEmail }) {
  await post([
    text(`*Sent* email ${step} of 4 to *${name}* (${school})\n>${subject}\nfrom ${fromEmail} -> ${to}`),
  ])
}

async function notifyReply({ from, name, school, subject, snippet, draftReply }) {
  const blocks = [
    divider(),
    text(`:email: *Reply from ${name}* (${school})\n*Subject:* ${subject}\n>${snippet}`),
  ]
  if (draftReply) {
    blocks.push(text(`*Suggested reply:*\n\`\`\`${draftReply}\`\`\``))
  }
  await post(blocks)
}

async function notifyPositiveReply({ from, name, school, subject, snippet, draftReply }) {
  const blocks = [
    divider(),
    text(`:fire: *POSITIVE reply from ${name}* (${school})\n*Subject:* ${subject}\n>${snippet}`),
  ]
  if (draftReply) {
    blocks.push(text(`*Suggested reply:*\n\`\`\`${draftReply}\`\`\``))
  }
  await post(blocks)
}

async function notifyBounce({ to, name, school }) {
  await post([text(`:warning: Bounce: *${name}* (${school}) <${to}> — marked in CRM`)])
}

async function dailyDigest({ sent, replies, positives, bounces, quarantined, opens, openRate, activeSequences, stepBreakdown, date }) {
  const lines = [
    `*XIQ Outbound — ${date}*`,
    '',
    `📤 *Sent today:* ${sent}   💬 *Replies:* ${replies}   🔥 *Positive:* ${positives}`,
    `👁 *Opens today:* ${opens}   📬 *Open rate (all-time):* ${openRate}%`,
    `⚠️ *Bounces:* ${bounces}   🚫 *Quarantined:* ${quarantined}`,
    '',
    `*Active sequences:* ${activeSequences}`,
  ]
  if (stepBreakdown) {
    lines.push(`*Step breakdown:* E1: ${stepBreakdown[1] || 0}  E2: ${stepBreakdown[2] || 0}  E3: ${stepBreakdown[3] || 0}  E4: ${stepBreakdown[4] || 0}  Done: ${stepBreakdown.done || 0}`)
  }
  await post([divider(), text(lines.join('\n'))])
}

async function notifyHealthIssue({ issue }) {
  await post([text(`:rotating_light: *Outbound health issue:* ${issue}`)])
}

module.exports = { notifySent, notifyReply, notifyPositiveReply, notifyBounce, dailyDigest, notifyHealthIssue }
