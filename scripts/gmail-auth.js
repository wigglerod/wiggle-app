// scripts/gmail-auth.js
// Run once: node scripts/gmail-auth.js
// Prerequisites: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your local .env file
// Output: prints GMAIL_REFRESH_TOKEN to the terminal — copy it to Vercel env vars

import { createServer } from 'http'
import open from 'open'

const CLIENT_ID = process.env.GMAIL_CLIENT_ID
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3030/oauth/callback'
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in environment.')
  console.error('Add them to your .env file and run again.')
  process.exit(1)
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(SCOPES.join(' '))}&` +
  `access_type=offline&` +
  `prompt=consent`

console.log('\n🐾 Wiggle Gmail OAuth Setup\n')
console.log('Opening browser for Google authorization...')
console.log('If browser does not open, visit this URL manually:')
console.log(authUrl)
console.log('\nWaiting for authorization...\n')

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth/callback')) return

  const code = new URL(req.url, 'http://localhost:3030').searchParams.get('code')

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<h2>✅ Authorization successful! Return to your terminal.</h2>')
  server.close()

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  })

  const tokens = await tokenRes.json()

  if (tokens.refresh_token) {
    console.log('✅ Authorization successful!\n')
    console.log('─────────────────────────────────────────')
    console.log('Add this to Vercel env vars as GMAIL_REFRESH_TOKEN:\n')
    console.log(tokens.refresh_token)
    console.log('─────────────────────────────────────────')
    console.log('\nKeep this token secret. It grants read access to info@wiggledogwalks.com.')
  } else {
    console.error('❌ No refresh token received.')
    console.error('Full response:', JSON.stringify(tokens, null, 2))
    console.error('\nTip: Make sure prompt=consent is in the auth URL above.')
  }
})

server.listen(3030, () => {
  open(authUrl).catch(() => {
    console.log('Could not open browser automatically — visit the URL above manually.')
  })
})
