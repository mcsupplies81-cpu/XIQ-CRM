// Gmail API wrapper using OAuth 2.0 refresh tokens
// Each inbox has its own refresh token stored in env vars
// One-time browser auth per inbox via scripts/auth-inbox.cjs

const { google } = require('googleapis')
const path = require('path')
const fs = require('fs')

function getClientCredentials() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
  }
  const SECRET_PATH = path.join(__dirname, '../client_secret.json')
  const raw = JSON.parse(fs.readFileSync(SECRET_PATH, 'utf8'))
  const creds = raw.installed || raw.web
  return { clientId: creds.client_id, clientSecret: creds.client_secret }
}

// Build an authenticated OAuth2 client for a specific inbox
// Refresh token is stored as GMAIL_REFRESH_TOKEN_<sanitized email>
// e.g. cameron@usexiq.com -> GMAIL_REFRESH_TOKEN_CAMERON_USEXIQ_COM
function getEnvKey(email) {
  return 'GMAIL_REFRESH_TOKEN_' + email.toUpperCase().replace(/[@.]/g, '_')
}

function getOAuthClient(email) {
  const { clientId, clientSecret } = getClientCredentials()
  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3456'
  )
  const refreshToken = process.env[getEnvKey(email)]
  if (!refreshToken) {
    throw new Error(`No refresh token for ${email}. Run: node outbound/scripts/auth-inbox.cjs ${email}`)
  }
  oauth2.setCredentials({ refresh_token: refreshToken })
  return oauth2
}

function getClient(email) {
  return google.gmail({ version: 'v1', auth: getOAuthClient(email) })
}

function encodeHeader(str) {
  if (/^[\x00-\x7F]*$/.test(str)) return str
  return '=?UTF-8?B?' + Buffer.from(str, 'utf8').toString('base64') + '?='
}

function encodeMime(to, from, subject, body, trackingPixelUrl) {
  const htmlBody = `<html><body><pre style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />` : ''}</body></html>`
  const mime = [
    `From: Cameron | XIQ <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ].join('\r\n')
  return Buffer.from(mime, 'utf8').toString('base64url')
}

async function sendEmail({ from, to, subject, body, trackingPixelUrl }) {
  const gmail = getClient(from)
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMime(to, from, subject, body, trackingPixelUrl) },
  })
  return res.data
}

async function sendReply({ from, to, subject, body, threadId, inReplyTo }) {
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
  const mime = [
    `From: Cameron | XIQ <${from}>`,
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${inReplyTo}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')
  const raw = Buffer.from(mime).toString('base64url')
  const gmail = getClient(from)
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId },
  })
  return res.data
}

async function getNewReplies(fromEmail, sinceDate) {
  const gmail = getClient(fromEmail)
  const after = Math.floor(sinceDate.getTime() / 1000)
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `in:inbox after:${after}`,
    maxResults: 50,
  })
  const messages = res.data.messages || []
  const replies = []
  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const headers = full.data.payload.headers
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
    replies.push({
      id: msg.id,
      threadId: full.data.threadId,
      from: getHeader('From'),
      subject: getHeader('Subject'),
      snippet: full.data.snippet,
      raw: full.data,
    })
  }
  return replies
}

async function markRead(fromEmail, messageId) {
  const gmail = getClient(fromEmail)
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}

module.exports = { sendEmail, sendReply, getNewReplies, markRead, getEnvKey }
