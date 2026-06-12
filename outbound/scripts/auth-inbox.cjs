// One-time auth script — run once per inbox to get a refresh token
// Usage: node outbound/scripts/auth-inbox.cjs cameron@usexiq.com
//
// Opens a browser, you log in as that inbox, approve, done.
// Prints the env var line to add to your .env file.

const { google } = require('googleapis')
const http = require('http')
const path = require('path')
const fs = require('fs')

const SECRET_PATH = path.join(__dirname, '../client_secret.json')
const email = process.argv[2]

if (!email) {
  console.error('Usage: node auth-inbox.cjs <email@usexiq.com>')
  process.exit(1)
}

if (!fs.existsSync(SECRET_PATH)) {
  console.error(`client_secret.json not found at ${SECRET_PATH}`)
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(SECRET_PATH, 'utf8'))
const creds = raw.installed || raw.web
const PORT = 3456
const REDIRECT = `http://localhost:${PORT}`

const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT)

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
  prompt: 'consent',
  login_hint: email,
})

console.log('\n--- XIQ Outbound: Authorize inbox ---')
console.log(`\nInbox: ${email}`)
console.log('\nOpening browser... if it does not open, visit this URL manually:')
console.log(`\n${authUrl}\n`)

// Try to open browser
const open = (url) => {
  const { exec } = require('child_process')
  exec(`open "${url}"`, () => {})
}
open(authUrl)

// Local server catches the redirect
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/?')) return
  const code = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('code')
  if (!code) {
    res.end('No code received. Try again.')
    server.close()
    return
  }

  res.end('<html><body><h2>Authorized. You can close this tab.</h2></body></html>')
  server.close()

  try {
    const { tokens } = await oauth2.getToken(code)
    const envKey = 'GMAIL_REFRESH_TOKEN_' + email.toUpperCase().replace(/[@.]/g, '_')
    console.log('\nAuthorized! Add this line to your .env file:\n')
    console.log(`${envKey}=${tokens.refresh_token}`)
    console.log('\nRepeat for your next inbox: node outbound/scripts/auth-inbox.cjs <next-email>')
  } catch (err) {
    console.error('\nAuth failed:', err.message)
  }
})

server.listen(PORT, () => {
  console.log(`Waiting for Google to redirect back... (listening on port ${PORT})`)
})
