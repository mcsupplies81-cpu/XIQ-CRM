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
    text(`*Sent* email ${step} of 3 to *${name}* (${school})\n>${subject}\nfrom ${fromEmail} -> ${to}`),
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

async function dailyDigest({ sent, replies, positives, bounces, date }) {
  await post([
    divider(),
    text(`*XIQ Outbound — ${date}*\n*Sent:* ${sent}  |  *Replies:* ${replies}  |  *Positive:* ${positives}  |  *Bounces:* ${bounces}`),
  ])
}

async function notifyHealthIssue({ issue }) {
  await post([text(`:rotating_light: *Outbound health issue:* ${issue}`)])
}

module.exports = { notifySent, notifyReply, notifyPositiveReply, notifyBounce, dailyDigest, notifyHealthIssue }
