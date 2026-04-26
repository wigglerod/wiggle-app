// api/scout-webhook.js
// Instagram DM webhook receiver for The Scout pipeline.
// GET  → Meta webhook verification (hub.verify_token check)
// POST → Receives DM payloads, upserts into flag_cards in Supabase
//        (source='instagram', onConflict 'source,source_id', status='open')
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
      const mid = messaging?.message?.mid
      const senderId = messaging?.sender?.id

      if (!messageText || !senderId) {
        console.warn('[scout-webhook] POST missing message text or sender id')
        return res.status(200).json({ received: true })
      }

      // Decision #46: Meta fires duplicate events on legacy Messenger (16-digit PSID)
      // and Instagram (17-digit IGSID). Drop the legacy channel; keep IG only.
      if (/^\d{16}$/.test(String(senderId))) {
        console.log('[scout-webhook] Dropped legacy Messenger channel duplicate.')
        return res.status(200).json({ received: true })
      }

      const today = new Date().toISOString().split('T')[0]
      const sourceId = mid || `ig_${senderId}_${Date.now()}`
      const supabase = getAdminClient()

      const { data, error } = await supabase
        .from('flag_cards')
        .upsert(
          {
            source: 'instagram',
            source_id: sourceId,
            source_thread_id: String(senderId),
            raw_excerpt: messageText,
            scout_run_date: today,
            status: 'open'
          },
          { onConflict: 'source,source_id' }
        )
        .select()

      if (error) {
        console.error(`[scout-webhook] Supabase upsert error: ${error.message}`)
      } else if (!data || data.length === 0) {
        console.warn(`[scout-webhook] Silent skip — upsert matched conflict, no row written. source_id=${sourceId}`)
      } else {
        console.log(`[scout-webhook] Card written — source_id=${sourceId}, row_id=${data[0].id}`)
      }
    } catch (err) {
      console.error(`[scout-webhook] Error processing DM: ${err.message}`)
    }

    // Always 200 so Meta doesn't retry
    return res.status(200).json({ received: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
