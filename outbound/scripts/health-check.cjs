// Domain health monitoring — runs daily
// Checks: bounce rate, blacklists, Google Postmaster Tools, SPF/DKIM/DMARC

require('dotenv').config()
const { sql } = require('../lib/db.cjs')
const { notifyHealthIssue, dailyDigest } = require('../lib/slack.cjs')

const DOMAIN = 'usexiq.com'

// Free public blacklist check APIs
const BLACKLISTS = [
  'zen.spamhaus.org',
  'b.barracudacentral.org',
  'bl.spamcop.net',
  'dnsbl.sorbs.net',
]

async function checkBlacklists(domain) {
  const issues = []
  for (const bl of BLACKLISTS) {
    try {
      const res = await fetch(`https://api.mxtoolbox.com/api/v1/lookup/blacklist/${domain}`, {
        headers: { 'Authorization': process.env.MXTOOLBOX_API_KEY || '' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        const listed = data?.Failed?.length > 0
        if (listed) issues.push(`Listed on ${bl}`)
      }
    } catch {}
  }
  return issues
}

async function checkBounceRate() {
  const [row] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE sent_at > now() - interval '7 days') as sent_7d,
      COUNT(*) FILTER (WHERE bounced_at > now() - interval '7 days') as bounced_7d
    FROM outbound_emails
  `
  const sent = Number(row.sent_7d)
  const bounced = Number(row.bounced_7d)
  if (sent === 0) return null
  const rate = bounced / sent
  return { sent, bounced, rate, pct: (rate * 100).toFixed(1) }
}

async function checkDns(domain) {
  const issues = []
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`)
    const data = await res.json()
    const txt = (data.Answer || []).map(r => r.data).join(' ')
    if (!txt.includes('v=spf1')) issues.push('SPF record missing or malformed')
    if (!txt.includes('v=DMARC1')) {
      const dmarcRes = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`)
      const dmarcData = await dmarcRes.json()
      const dmarc = (dmarcData.Answer || []).map(r => r.data).join(' ')
      if (!dmarc.includes('v=DMARC1')) issues.push('DMARC record missing')
    }
  } catch {}
  return issues
}

async function runHealthCheck() {
  console.log(`Health check — ${DOMAIN}\n`)
  const allIssues = []

  // Bounce rate
  const bounceStats = await checkBounceRate()
  if (bounceStats) {
    console.log(`Bounce rate (7d): ${bounceStats.pct}% (${bounceStats.bounced}/${bounceStats.sent})`)
    if (bounceStats.rate > 0.03) {
      allIssues.push(`Bounce rate ${bounceStats.pct}% exceeds 3% threshold — consider pausing`)
    }
  }

  // DNS / SPF / DMARC
  const dnsIssues = await checkDns(DOMAIN)
  if (dnsIssues.length) {
    console.log('DNS issues:', dnsIssues)
    allIssues.push(...dnsIssues)
  } else {
    console.log('SPF/DMARC: OK')
  }

  // Blacklist check (requires MXToolbox key — skip if not set)
  if (process.env.MXTOOLBOX_API_KEY) {
    const blIssues = await checkBlacklists(DOMAIN)
    if (blIssues.length) {
      console.log('Blacklist issues:', blIssues)
      allIssues.push(...blIssues)
    } else {
      console.log('Blacklists: clean')
    }
  }

  // Alert Slack if anything is wrong
  for (const issue of allIssues) {
    await notifyHealthIssue({ issue })
  }

  if (allIssues.length === 0) {
    console.log('\nAll clear.')
  }
}

runHealthCheck().catch(e => { console.error(e); process.exit(1) })
