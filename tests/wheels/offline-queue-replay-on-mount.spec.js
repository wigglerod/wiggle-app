// Wheel 2 — Bug 1: offline queue must replay on mount.
//
// Before fix: replayOfflineQueue only fires from window's 'online' event.
// `navigator.onLine === true` at app start does not fire an 'online' event,
// so a queue surviving a PWA process death sits in localStorage forever.
//
// After fix: useOffline mount inspects localStorage; if a non-empty queue
// exists AND navigator.onLine is true, replay runs immediately.
//
// This test seeds a queue, loads the page (with the user already logged in
// via localStorage session), and asserts the DB receives the queued row.

import { test, expect } from '@playwright/test'
import {
  admin,
  ensureTestWalker,
  loginAs,
  pickPlateauDog,
  TEST_WALKERS,
  todayInToronto,
  sleep,
} from './_helpers.js'

test('offline queue replays on mount when already online', async ({ page }) => {
  const walkerId = await ensureTestWalker(TEST_WALKERS.a)
  const dog = await pickPlateauDog()
  const walkDate = todayInToronto()

  // Clean any prior pickup rows for the test walker on this dog today.
  await admin
    .from('walker_notes')
    .delete()
    .eq('walker_id', walkerId)
    .eq('dog_id', dog.id)
    .eq('walk_date', walkDate)

  // Sign in (so the supabase JS client on the page has an authenticated session).
  await loginAs(page, TEST_WALKERS.a)

  // Seed a queue item directly into localStorage — same shape replayOfflineQueue
  // expects (type:'insert', table, data). Created_at far enough in the past to
  // make it identifiable (00:00 today Toronto).
  const seededTimestamp = new Date(`${walkDate}T00:01:00-04:00`).toISOString()
  const seededRow = {
    dog_id: dog.id,
    dog_name: dog.dog_name,
    walker_id: walkerId,
    walker_name: TEST_WALKERS.a.full_name,
    note_type: 'pickup',
    walk_date: walkDate,
    created_at: seededTimestamp,
  }

  await page.evaluate(({ row }) => {
    const queue = [{ type: 'insert', table: 'walker_notes', data: row, timestamp: Date.now() }]
    localStorage.setItem('wiggle_offline_queue', JSON.stringify(queue))
  }, { row: seededRow })

  // Reload the page so useOffline mounts fresh with the seeded queue.
  await page.reload()
  // Wait for ProtectedRoute to settle on Dashboard again.
  await page.getByRole('button', { name: 'Schedule' }).waitFor({ state: 'visible', timeout: 20_000 })

  // Give replay up to 10s to drain.
  for (let i = 0; i < 20; i++) {
    await sleep(500)
    const { data } = await admin
      .from('walker_notes')
      .select('id, note_type, created_at')
      .eq('walker_id', walkerId)
      .eq('dog_id', dog.id)
      .eq('walk_date', walkDate)
      .eq('note_type', 'pickup')
    if ((data || []).length > 0) {
      // The replay succeeded — assert the row is the seeded one.
      expect(new Date(data[0].created_at).toISOString()).toBe(seededTimestamp)
      // And the queue should be drained.
      const remaining = await page.evaluate(() => localStorage.getItem('wiggle_offline_queue'))
      expect(remaining === null || JSON.parse(remaining).length === 0).toBe(true)
      await admin
        .from('walker_notes')
        .delete()
        .eq('walker_id', walkerId)
        .eq('dog_id', dog.id)
        .eq('walk_date', walkDate)
      return
    }
  }
  throw new Error('queue never drained — replay did not fire on mount')
})
