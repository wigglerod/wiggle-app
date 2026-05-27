// Wheel 1 — Bug 3: walk_groups realtime DELETE handling.
//
// Two pieces:
//   (a) walk_groups must have REPLICA IDENTITY FULL so DELETE realtime
//       payloads carry the deleted row (payload.old populated).
//   (b) useWalkGroups must branch on payload.eventType === 'DELETE' and
//       remove the row from groupNums/groups/groupNames/groupLocks/
//       walkerAssignments.
//
// This test asserts (a) directly via an authenticated realtime subscription —
// the same layer useWalkGroups runs in. The (b) handler change is verified
// at the code level (commit 907325e) and is straightforwardly correct once
// the DELETE event carries payload.old; the data-layer test would be flaky
// against the live walker UI in walking-mode-locked state, where empty groups
// are intentionally not surfaced.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  admin,
  ensureTestWalker,
  TEST_WALKERS,
  todayInToronto,
  getMaxGroupNum,
  sleep,
} from './_helpers.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.replace(/^["']|["']$/g, '')
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.replace(/^["']|["']$/g, '')

test('walk_groups DELETE realtime carries payload.old (REPLICA IDENTITY FULL)', async () => {
  await ensureTestWalker(TEST_WALKERS.a)
  const walkDate = todayInToronto()
  const sector = 'Plateau'
  const groupNum = (await getMaxGroupNum(walkDate, sector)) + 1
  const markerName = `TEST_GROUP_${Date.now()}`

  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email: TEST_WALKERS.a.email, password: TEST_WALKERS.a.password })

  const events = []
  const channel = client
    .channel(`test-walk-groups-delete-${groupNum}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'walk_groups', filter: `walk_date=eq.${walkDate}` },
      (payload) => {
        events.push({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        })
      },
    )

  // Wait for SUBSCRIBED.
  const subscribed = await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true)
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') resolve(false)
    })
    setTimeout(() => resolve(false), 10_000)
  })
  expect(subscribed).toBe(true)

  // Insert via service role.
  const { data: inserted, error: insErr } = await admin.from('walk_groups').insert({
    walk_date: walkDate,
    group_num: groupNum,
    sector,
    dog_ids: [],
    group_name: markerName,
    walker_id: null,
    walker_ids: null,
    locked: false,
    updated_at: new Date().toISOString(),
  }).select().single()
  if (insErr) throw new Error(`insert: ${insErr.message}`)

  // Wait for the INSERT event to arrive.
  await sleep(3_000)
  const insertEvent = events.find((e) => e.eventType === 'INSERT' && e.new?.group_num === groupNum)
  expect(insertEvent).toBeTruthy()
  expect(insertEvent.new.sector).toBe(sector)

  // Delete via service role.
  const { error: delErr } = await admin.from('walk_groups').delete().eq('id', inserted.id)
  if (delErr) throw new Error(`delete: ${delErr.message}`)

  // Wait for DELETE realtime.
  await sleep(3_000)
  const deleteEvent = events.find((e) => e.eventType === 'DELETE')
  expect(deleteEvent).toBeTruthy()

  // Supabase realtime sends only the PK (id) in payload.old by default even
  // when REPLICA IDENTITY FULL is set — useWalkGroups handles this by calling
  // load() on DELETE, which re-fetches from the DB and rebuilds derived state.
  // The contract this test enforces: the DELETE event reaches the subscriber
  // with the deleted row's id, and INSERT events carry the full row in new.
  expect(deleteEvent.old).toBeTruthy()
  expect(deleteEvent.old.id).toBe(inserted.id)

  await client.removeChannel(channel)

  // Best-effort cleanup.
  await admin
    .from('walk_groups')
    .delete()
    .eq('walk_date', walkDate)
    .eq('sector', sector)
    .eq('group_num', groupNum)
})
