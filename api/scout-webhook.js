// api/scout-webhook.js
// Instagram DM webhook receiver for The Scout pipeline.
// GET  → Meta webhook verification (hub.verify_token check)
// POST → Receives DM payloads, writes to scout_cards in Supabase
//
// Always returns 200 to Meta on POST — even on error — to prevent retries.

import { getAdminClient } from './lib/supabase-admin.js'

const VERIFY_TOKEN = 'wiggle_scout_2026'

export default async function handler(req, res) {
  // ── GET: Webhook verification ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[scout-webhook] Verification succeeded')
      return res.status(200).send(challenge)
    }

    console.warn('[scout-webhook] Verification failed — bad token or mode')
    return res.status(403).json({ error: 'Forbidden' })
  }

  // ── POST: Receive Instagram DM ──
  if (req.method === 'POST') {
    try {
      const body = req.body
      const messaging = body?.entry?.[0]?.messaging?.[0]
      const messageText = messaging?.message?.text
      const senderId = messaging?.sender?.id

      if (!messageText || !senderId) {
        console.warn('[scout-webhook] POST missing message text or sender id')
        return res.status(200).json({ received: true })
      }

      const today = new Date().toISOString().split('T')[0]
      const supabase = getAdminClient()

      const { error } = await supabase
        .from('scout_cards')
        .insert({
          source: 'instagram_dm',
          raw_message: messageText,
          sender_id: String(senderId),
          run_date: today,
          category: null,
          summary: null,
          dog_name: null
        })

      if (error) {
        console.error(`[scout-webhook] Supabase insert error: ${error.message}`)
      } else {
        console.log(`[scout-webhook] Card written — sender ${senderId}`)
      }
    } catch (err) {
      console.error(`[scout-webhook] Error processing DM: ${err.message}`)
    }

    // Always 200 so Meta doesn't retry
    return res.status(200).json({ received: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
