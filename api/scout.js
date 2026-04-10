// api/scout.js
// The Scout — Agent 4 in the Wiggle pipeline.
// Reads: Acuity bookings (direct API) + Gmail inbox (OAuth via api/lib/gmail.js)
// Writes: flag_cards table in Supabase — nothing else
// Runs: 9 AM EDT weekdays via Vercel cron (one hour after Mini Gen)
//
// The Scout stops at flag_cards. Gen reviews in Tower and decides what to do.
// Same "stop and wait" discipline as every AI agent in Wiggle.

import { getAdminClient } from './lib/supabase-admin.js'
import { getAccessToken, searchMessages, getMessage } from './lib/gmail.js'

// Acuity credentials — same as api/acuity.js
const ACUITY_USER_ID = process.env.ACUITY_USER_ID
const ACUITY_API_KEY = process.env.ACUITY_API_KEY
const ACUITY_BASE = 'https://acuityscheduling.com/api/v1'

// Senders to always skip in Gmail
// These produce high-volume noise that Gen never needs to see
const SKIP_SENDERS = [
  'acuityscheduling.com',
  'squarespace.com',
  'wiggledogwalks.com',  // outbound from our own address
  'noreply@',
  'no-reply@',
  'mailer-daemon@',
  'notifications@wix'
]

export default async function handler(req, res) {
  // Auth — cron header or manual POST with Bearer secret
  const secret = req.headers['x-cron-secret'] || req.headers.authorization?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const summary = {
    run_date: today,
    acuity_scanned: 0,
    acuity_flagged: 0,
    gmail_scanned: 0,
    gmail_flagged: 0,
    cards_written: 0,
    errors: []
  }

  try {

    // ─────────────────────────────────────────
    // STEP 1: Load context from Supabase
    // ─────────────────────────────────────────

    console.log('[scout] Loading context from Supabase')

    // All dog emails for matching inbound Gmail messages to known dogs
    const { data: dogs } = await supabase
      .from('dogs')
      .select('id, dog_name, email, owner_first, owner_last, sector')

    // Build email → dog lookup
    // emails in dogs table can be comma-separated ("owner1@x.com, owner2@x.com")
    const emailToDog = {}
    dogs?.forEach(dog => {
      if (!dog.email) return
      dog.email.split(',').map(e => e.trim().toLowerCase()).forEach(email => {
        if (email) emailToDog[email] = {
          dog_name: dog.dog_name,
          dog_id: dog.id,
          owner_name: `${dog.owner_first || ''} ${dog.owner_last || ''}`.trim(),
          sector: dog.sector
        }
      })
    })

    // Acuity name map for resolving booking owner names
    const { data: nameMap } = await supabase
      .from('acuity_name_map')
      .select('acuity_name, dog_name, acuity_email')

    // Build lookup by name (lowercased) and email for disambiguation
    const nameMapLookup = {}
    nameMap?.forEach(entry => {
      nameMapLookup[entry.acuity_name.toLowerCase()] = entry.dog_name
      if (entry.acuity_email) {
        nameMapLookup[entry.acuity_email.toLowerCase()] = entry.dog_name
      }
    })

    // Deduplication: source_ids already written in last 7 days
    const { data: recentCards } = await supabase
      .from('flag_cards')
      .select('source_id')
      .not('source_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const processedIds = new Set(recentCards?.map(c => c.source_id) || [])
    console.log(`[scout] Context loaded: ${dogs?.length || 0} dogs, ${nameMap?.length || 0} name map entries, ${processedIds.size} already-processed IDs`)

    // ─────────────────────────────────────────
    // STEP 2: Read Acuity appointments
    // Next 2 days (today + tomorrow + day after)
    // Create cards for: booking notes + unresolved names
    // ─────────────────────────────────────────

    console.log('[scout] Fetching Acuity appointments')

    const acuityAuth = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64')
    const minDate = today
    const maxDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const acuityRes = await fetch(
      `${ACUITY_BASE}/appointments?minDate=${minDate}&maxDate=${maxDate}&max=200`,
      { headers: { Authorization: `Basic ${acuityAuth}` } }
    )

    const appointments = await acuityRes.json()
    const acuityCards = []

    for (const appt of appointments) {
      summary.acuity_scanned++

      const sourceIdBase = `acuity_${appt.id}`
      const ownerEmail = appt.email?.split(',')[0]?.trim().toLowerCase() || ''
      const ownerFullName = `${appt.firstName} ${appt.lastName}`.trim()
      const ownerNameKey = ownerFullName.toLowerCase()

      // Try to resolve the dog: email first, then name map
      const resolvedDog =
        emailToDog[ownerEmail] ||
        (nameMapLookup[ownerNameKey] ? { dog_name: nameMapLookup[ownerNameKey] } : null) ||
        (nameMapLookup[ownerEmail] ? { dog_name: nameMapLookup[ownerEmail] } : null)

      const walkDate = appt.datetime?.split('T')[0] || null

      // Card type 1: Owner wrote a booking note — walkers need to know
      if (appt.notes && appt.notes.trim().length > 0) {
        const sourceId = `${sourceIdBase}_note`
        if (!processedIds.has(sourceId)) {
          acuityCards.push({
            source: 'acuity',
            source_id: sourceId,
            source_thread_id: null,
            dog_name: resolvedDog?.dog_name || null,
            dog_id: resolvedDog?.dog_id || null,
            owner_name: ownerFullName,
            owner_email: ownerEmail,
            category: 'booking_note',
            summary: `${resolvedDog?.dog_name || appt.firstName} — owner left a note for ${walkDate} walk`,
            raw_excerpt: appt.notes.slice(0, 500),
            walk_date: walkDate,
            priority: 'normal',
            status: 'open',
            scout_run_date: today
          })
          summary.acuity_flagged++
        }
      }

      // Card type 2: Name not in acuity_name_map — Mini Gen can't resolve this booking
      if (!resolvedDog) {
        const sourceId = `${sourceIdBase}_unresolved`
        if (!processedIds.has(sourceId)) {
          acuityCards.push({
            source: 'acuity',
            source_id: sourceId,
            source_thread_id: null,
            dog_name: null,
            dog_id: null,
            owner_name: ownerFullName,
            owner_email: ownerEmail,
            category: 'name_unresolved',
            summary: `"${ownerFullName}" booked for ${walkDate} but name not in dog database`,
            raw_excerpt: `Acuity ID: ${appt.id} · Email: ${ownerEmail} · Type: ${appt.type || 'unknown'}`,
            walk_date: walkDate,
            priority: 'high',
            status: 'open',
            scout_run_date: today
          })
          summary.acuity_flagged++
        }
      }
    }

    console.log(`[scout] Acuity: ${summary.acuity_scanned} scanned, ${summary.acuity_flagged} flagged`)

    // ─────────────────────────────────────────
    // STEP 3: Read Gmail inbox
    // Last 48 hours, inbound to info@wiggledogwalks.com
    // Skip known noise senders. Classify the rest with Claude Haiku.
    // Gmail failure does NOT stop Acuity cards from being written.
    // ─────────────────────────────────────────

    const gmailCards = []

    try {
      console.log('[scout] Fetching Gmail access token')
      const accessToken = await getAccessToken()

      const query = 'to:info@wiggledogwalks.com is:inbox newer_than:2d'
      const messages = await searchMessages(accessToken, query, 50)
      console.log(`[scout] Gmail: ${messages.length} messages found`)

      for (const { id: messageId, threadId } of messages) {
        summary.gmail_scanned++

        const sourceId = `gmail_${messageId}`
        if (processedIds.has(sourceId)) continue

        const msg = await getMessage(accessToken, messageId)

        // Skip noise senders
        const shouldSkip = SKIP_SENDERS.some(s =>
          msg.fromEmail.includes(s) || msg.from.toLowerCase().includes(s)
        )
        if (shouldSkip) {
          console.log(`[scout] Skipping ${msg.fromEmail} (matched skip list)`)
          continue
        }

        // Resolve dog from sender email
        const resolvedDog = emailToDog[msg.fromEmail] || null

        // Classify with Claude Haiku
        const classification = await classifyEmail(msg, resolvedDog)
        if (classification.skip) {
          console.log(`[scout] Skipping "${msg.subject}" — classified as skip`)
          continue
        }

        gmailCards.push({
          source: 'gmail',
          source_id: sourceId,
          source_thread_id: threadId,
          dog_name: resolvedDog?.dog_name || null,
          dog_id: resolvedDog?.dog_id || null,
          owner_name: msg.from,
          owner_email: msg.fromEmail,
          category: classification.category,
          summary: classification.summary,
          raw_excerpt: `Subject: ${msg.subject}\n\n${msg.body.slice(0, 450)}`,
          walk_date: classification.walk_date || null,
          priority: classification.priority,
          status: 'open',
          scout_run_date: today
        })
        summary.gmail_flagged++
      }

      console.log(`[scout] Gmail: ${summary.gmail_scanned} scanned, ${summary.gmail_flagged} flagged`)

    } catch (gmailErr) {
      // Gmail failure is non-fatal — Acuity cards still get written
      console.error(`[scout] Gmail error (non-fatal): ${gmailErr.message}`)
      summary.errors.push(`Gmail: ${gmailErr.message}`)
    }

    // ─────────────────────────────────────────
    // STEP 4: Write all cards to Supabase
    // ON CONFLICT DO NOTHING — safe to run multiple times
    // ─────────────────────────────────────────

    const allCards = [...acuityCards, ...gmailCards]
    console.log(`[scout] Writing ${allCards.length} cards to flag_cards`)

    if (allCards.length > 0) {
      const { error } = await supabase
        .from('flag_cards')
        .upsert(allCards, {
          onConflict: 'source,source_id',
          ignoreDuplicates: true
        })

      if (error) {
        console.error(`[scout] Supabase write error: ${error.message}`)
        summary.errors.push(`Supabase write: ${error.message}`)
      } else {
        summary.cards_written = allCards.length
        console.log(`[scout] Done. ${summary.cards_written} cards written.`)
      }
    } else {
      console.log('[scout] No new cards to write.')
    }

    return res.status(200).json({ success: true, summary })

  } catch (err) {
    console.error(`[scout] Fatal error: ${err.message}`)
    summary.errors.push(`Fatal: ${err.message}`)
    return res.status(500).json({ success: false, summary })
  }
}

// ─────────────────────────────────────────
// classifyEmail
// One Claude Haiku call per email message.
// Returns { category, priority, summary, walk_date, skip }
// On failure: returns a safe 'unknown' card rather than losing the message.
// ─────────────────────────────────────────

async function classifyEmail(msg, resolvedDog) {
  const dogContext = resolvedDog
    ? `This email is from the owner of ${resolvedDog.dog_name} (${resolvedDog.sector} sector).`
    : 'This sender is not in the Wiggle client database — may be a new lead or unknown sender.'

  const prompt = `You are The Scout for Wiggle Dog Walks, a Montréal dog walking company.
Classify this inbound email and write a one-sentence summary for the operations manager Gen.

${dogContext}

Email:
From: ${msg.from} <${msg.fromEmail}>
Subject: ${msg.subject}
Body: ${msg.body.slice(0, 600)}

Respond with a JSON object only. No explanation. No markdown. No backticks. Just the raw JSON:
{
  "category": "booking_question" | "scheduling_request" | "client_message" | "new_lead" | "booking_note" | "conflict" | "unknown",
  "priority": "high" | "normal" | "low",
  "summary": "one sentence, max 100 characters, written for Gen",
  "walk_date": "YYYY-MM-DD if a specific date is mentioned, otherwise null",
  "skip": true or false
}

Set skip=true for: sales pitches, automated notifications, receipts, spam, irrelevant messages.
Set skip=false for anything a dog walking operations manager should know about.

Category definitions:
  booking_question     — owner asking if their dog is booked for a specific day
  scheduling_request   — owner asking to add, change, or cancel a walk day
  client_message       — general message about their dog (health, behaviour, logistics)
  new_lead             — someone not yet a client asking about services
  booking_note         — owner leaving specific instructions for today's walk
  conflict             — duplicate booking or scheduling inconsistency
  unknown              — relevant but cannot be clearly classified`

  const fallback = {
    category: 'unknown',
    priority: 'normal',
    summary: `Unclassified message from ${msg.from} — subject: "${msg.subject.slice(0, 50)}"`,
    walk_date: null,
    skip: false
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(`[scout] classifyEmail API error for "${msg.subject}": ${response.status} — ${JSON.stringify(data)}`)
      return fallback
    }

    const text = data.content?.[0]?.text
    if (!text) {
      console.error(`[scout] classifyEmail empty response for "${msg.subject}": ${JSON.stringify(data)}`)
      return fallback
    }

    const result = JSON.parse(text.trim())

    if (!result.category || !result.summary) {
      console.error(`[scout] classifyEmail incomplete parse for "${msg.subject}": ${text}`)
      return fallback
    }

    console.log(`[scout] classifyEmail OK for "${msg.subject}": category=${result.category}, dog=${resolvedDog?.dog_name || 'unknown'}`)
    return result

  } catch (err) {
    console.error(`[scout] classifyEmail failed for "${msg.subject}": ${err.message}`)
    return fallback
  }
}

// ═══════════════════════════════════════════════════
// INSTAGRAM DMs — PENDING META APPROVAL
// ═══════════════════════════════════════════════════
// Status: Waiting for instagram_manage_messages permission (2–4 weeks from application)
// When approved: add a STEP 3b below Gmail, same pattern
// source value in flag_cards: 'instagram'
// Env var needed: INSTAGRAM_ACCESS_TOKEN
// Endpoint: GET https://graph.facebook.com/v18.0/{ig-user-id}/conversations
// ═══════════════════════════════════════════════════
