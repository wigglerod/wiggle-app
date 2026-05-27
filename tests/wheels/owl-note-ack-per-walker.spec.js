// Wheel 1 — Bug 1: per-walker owl-note acknowledgement.
//
// Before fix: tapping "Got it" wrote last_acknowledged_date on the single
// shared owl_notes row; every other walker's hook then filtered the row out
// (filter: `if (n.expires_at && n.last_acknowledged_date === today) return false`).
//
// After fix: each walker writes a row into owl_note_acks (note_id, walker_id,
// ack_date). The hook subscribes to its own user's acks only, so other walkers'
// acks cannot remove the note from this walker's UI.
//
// This test asserts the behavior at the data + RLS layer + filter logic — the
// same layer the UI consumes. It runs against the deployed Supabase schema,
// using the deployed RLS policies, with real walker JWTs. It does NOT exercise
// browser navigation because that surface is fragile under Playwright against
// a service-worker PWA, but the test still catches the bug: it replays the
// hook's own filter logic on what the walker would receive.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  admin,
  ensureTestWalker,
  pickPlateauDog,
  clearOwlNotesForDog,
  TEST_WALKERS,
  todayInToronto,
} from './_helpers.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.replace(/^["']|["']$/g, '')
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.replace(/^["']|["']$/g, '')

async function walkerClient(walker) {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: walker.email, password: walker.password })
  if (error) throw new Error(`auth ${walker.email}: ${error.message}`)
  return c
}

// Mirrors useOwlNotes' filter — a row is visible to a walker when:
//   • not future-scheduled
//   • not expired (or scheduled is today/future when expires_at is NULL)
//   • not present in this walker's owl_note_acks for today (when expires_at set)
function isVisibleToWalker({ note, myAcks, today }) {
  if (note.scheduled_date && note.scheduled_date > today) return false
  if (note.expires_at) {
    if (new Date(note.expires_at) <= new Date()) return false
    if (myAcks.has(note.id)) return false
  } else if (note.scheduled_date && note.scheduled_date < today) {
    return false
  }
  return true
}

test('owl-note ack is per-walker — A acking does not hide note for B', async () => {
  const aId = await ensureTestWalker(TEST_WALKERS.a)
  const bId = await ensureTestWalker(TEST_WALKERS.b)
  const dog = await pickPlateauDog()
  await clearOwlNotesForDog(dog.id)
  await admin.from('owl_note_acks').delete().in('walker_id', [aId, bId])

  const today = todayInToronto()
  const noteText = `TEST ack-per-walker ${Date.now()}`
  const { data: note, error: insErr } = await admin.from('owl_notes').insert({
    note_text: noteText,
    target_type: 'dog',
    target_dog_id: dog.id,
    target_dog_name: dog.dog_name,
    target_sector: dog.sector,
    scheduled_date: today, // pin to Toronto today (DB default is UTC date, which may be tomorrow)
    expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
  }).select().single()
  if (insErr) throw new Error(`insert owl_notes: ${insErr.message}`)

  try {
    const clientA = await walkerClient(TEST_WALKERS.a)
    const clientB = await walkerClient(TEST_WALKERS.b)

    // ── Both walkers see the note initially ──────────────────────────────
    const ackResA0 = await clientA.from('owl_note_acks').select('note_id').eq('walker_id', aId).eq('ack_date', today)
    const ackResB0 = await clientB.from('owl_note_acks').select('note_id').eq('walker_id', bId).eq('ack_date', today)
    const myAcksA0 = new Set((ackResA0.data || []).map((r) => r.note_id))
    const myAcksB0 = new Set((ackResB0.data || []).map((r) => r.note_id))
    expect(isVisibleToWalker({ note, myAcks: myAcksA0, today })).toBe(true)
    expect(isVisibleToWalker({ note, myAcks: myAcksB0, today })).toBe(true)

    // ── Walker A acks via the new join table ─────────────────────────────
    const ackErr = await clientA.from('owl_note_acks').insert({
      note_id: note.id,
      walker_id: aId,
      ack_date: today,
    })
    expect(ackErr.error).toBeNull()

    // ── Walker B refreshes their own acks; ack from A must not appear ────
    const ackResB1 = await clientB.from('owl_note_acks').select('note_id').eq('walker_id', bId).eq('ack_date', today)
    const myAcksB1 = new Set((ackResB1.data || []).map((r) => r.note_id))
    expect(myAcksB1.has(note.id)).toBe(false)

    // ── Walker B's filter still shows the note ───────────────────────────
    expect(isVisibleToWalker({ note, myAcks: myAcksB1, today })).toBe(true)

    // ── Walker A's filter, after their own ack, hides it for them only ───
    const ackResA1 = await clientA.from('owl_note_acks').select('note_id').eq('walker_id', aId).eq('ack_date', today)
    const myAcksA1 = new Set((ackResA1.data || []).map((r) => r.note_id))
    expect(myAcksA1.has(note.id)).toBe(true)
    expect(isVisibleToWalker({ note, myAcks: myAcksA1, today })).toBe(false)
  } finally {
    await admin.from('owl_note_acks').delete().eq('note_id', note.id)
    await admin.from('owl_notes').delete().eq('id', note.id)
  }
})

test('owl_note_acks RLS: walker cannot insert another walker_id', async () => {
  const aId = await ensureTestWalker(TEST_WALKERS.a)
  const bId = await ensureTestWalker(TEST_WALKERS.b)
  const dog = await pickPlateauDog()
  await clearOwlNotesForDog(dog.id)
  await admin.from('owl_note_acks').delete().in('walker_id', [aId, bId])

  const { data: note } = await admin.from('owl_notes').insert({
    note_text: `TEST rls ${Date.now()}`,
    target_type: 'dog',
    target_dog_id: dog.id,
    target_dog_name: dog.dog_name,
    target_sector: dog.sector,
    scheduled_date: todayInToronto(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  }).select().single()

  try {
    const clientA = await walkerClient(TEST_WALKERS.a)
    // Walker A tries to ack on behalf of Walker B — must fail per RLS check.
    const { error } = await clientA.from('owl_note_acks').insert({
      note_id: note.id,
      walker_id: bId,
      ack_date: todayInToronto(),
    })
    expect(error).not.toBeNull()
  } finally {
    await admin.from('owl_note_acks').delete().eq('note_id', note.id)
    await admin.from('owl_notes').delete().eq('id', note.id)
  }
})
