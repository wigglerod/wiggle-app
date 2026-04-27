// api/ringcentral-test.js
// RingCentral SMS handshake test (decision #97, step 1).
// GET → JWT-authenticates against RingCentral Production API and reads
//       the account extension to prove the auth round-trip works.
// Read-only. Sends no SMS. Registers no webhook.
//
// Env vars (production only):
//   RINGCENTRAL_CLIENT_ID
//   RINGCENTRAL_CLIENT_SECRET
//   RINGCENTRAL_JWT
//   RINGCENTRAL_SERVER_URL  (https://platform.ringcentral.com)

import { SDK } from '@ringcentral/sdk'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const {
    RINGCENTRAL_CLIENT_ID,
    RINGCENTRAL_CLIENT_SECRET,
    RINGCENTRAL_JWT,
    RINGCENTRAL_SERVER_URL,
  } = process.env

  const missing = [
    ['RINGCENTRAL_CLIENT_ID', RINGCENTRAL_CLIENT_ID],
    ['RINGCENTRAL_CLIENT_SECRET', RINGCENTRAL_CLIENT_SECRET],
    ['RINGCENTRAL_JWT', RINGCENTRAL_JWT],
    ['RINGCENTRAL_SERVER_URL', RINGCENTRAL_SERVER_URL],
  ].filter(([, v]) => !v).map(([k]) => k)

  if (missing.length > 0) {
    const msg = `Missing env var(s): ${missing.join(', ')}`
    console.error('[ringcentral-test]', msg)
    return res.status(500).json({ ok: false, error: msg, stage: 'env' })
  }

  const rc = new SDK({
    server: RINGCENTRAL_SERVER_URL,
    clientId: RINGCENTRAL_CLIENT_ID,
    clientSecret: RINGCENTRAL_CLIENT_SECRET,
  })
  const platform = rc.platform()

  try {
    await platform.login({ jwt: RINGCENTRAL_JWT })
  } catch (err) {
    console.error('[ringcentral-test] login failed:', err)
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      stage: 'login',
    })
  }

  let extension
  try {
    const response = await platform.get('/restapi/v1.0/account/~/extension/~')
    extension = await response.json()
  } catch (err) {
    console.error('[ringcentral-test] fetch failed:', err)
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      stage: 'fetch',
    })
  }

  return res.status(200).json({
    ok: true,
    server: RINGCENTRAL_SERVER_URL,
    extension: {
      id: extension?.id ?? null,
      name: extension?.name ?? null,
      phoneNumber: extension?.phoneNumber ?? null,
    },
  })
}
