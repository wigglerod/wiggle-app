// Wheel 2 — Bug 2: offline queue race safety.
//
// Before fix: replayOfflineQueue reads the queue into a local array, processes
// items, then unconditionally `localStorage.removeItem(QUEUE_KEY)` at the end.
// Any enqueueOfflineAction call between the read and the remove is silently
// wiped — the walker's tap looks queued, then disappears.
//
// After fix: per-item drain. Each successful action is removed by its _id;
// items added during processing remain in the queue and either get processed
// in this drain cycle (if reached) or the next.
//
// This test enqueues item A, slows the walker_notes POST to give us a
// processing window, then enqueues item B from outside the replay loop.
// After replay settles, BOTH rows must be in walker_notes.

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

test('items enqueued mid-replay are not silently wiped', async ({ page }) => {
  const walkerId = await ensureTestWalker(TEST_WALKERS.a)
  const dog = await pickPlateauDog()
  const walkDate = todayInToronto()

  await admin
    .from('walker_notes')
    .delete()
    .eq('walker_id', walkerId)
    .eq('dog_id', dog.id)
    .eq('walk_date', walkDate)

  await loginAs(page, TEST_WALKERS.a)

  // Slow walker_notes POSTs so we have a real window to race against.
  await page.route('**/rest/v1/walker_notes**', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((r) => setTimeout(r, 1200))
    }
    return route.continue()
  })

  const tsA = new Date(`${walkDate}T00:01:00-04:00`).toISOString()
  const tsB = new Date(`${walkDate}T00:02:00-04:00`).toISOString()
  const baseRow = {
    dog_id: dog.id,
    dog_name: dog.dog_name,
    walker_id: walkerId,
    walker_name: TEST_WALKERS.a.full_name,
    note_type: 'pickup',
    walk_date: walkDate,
  }

  // Seed item A. We use note_type='pickup' for A; the second action is a
  // 'returned' note (different note_type so it doesn't collide via the
  // partial-unique index on walker_notes(dog_id, walk_date, note_type)).
  const rowA = { ...baseRow, note_type: 'pickup', created_at: tsA }
  const rowB = { ...baseRow, note_type: 'returned', created_at: tsB }

  await page.evaluate(({ row }) => {
    localStorage.setItem(
      'wiggle_offline_queue',
      JSON.stringify([{ type: 'insert', table: 'walker_notes', data: row, _id: 'seed-a', timestamp: Date.now() }]),
    )
  }, { row: rowA })

  // Trigger replay by firing the `online` event from the page.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))

  // While replay's first item is in-flight (1.2s slow), enqueue item B from
  // a separate task — this simulates a walker tap landing during drain.
  await sleep(300)
  await page.evaluate(({ row }) => {
    const queue = JSON.parse(localStorage.getItem('wiggle_offline_queue') || '[]')
    queue.push({ type: 'insert', table: 'walker_notes', data: row, _id: 'seed-b', timestamp: Date.now() })
    localStorage.setItem('wiggle_offline_queue', JSON.stringify(queue))
  }, { row: rowB })

  // Wait for the first drain to complete. Then fire `online` again to drain
  // any remaining items (the fix may leave B in the queue if it landed after
  // the snapshot was taken).
  await sleep(3000)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await sleep(3500)

  // Both rows must have made it to the DB.
  const { data: rows } = await admin
    .from('walker_notes')
    .select('note_type, created_at')
    .eq('walker_id', walkerId)
    .eq('dog_id', dog.id)
    .eq('walk_date', walkDate)
    .order('created_at', { ascending: true })

  try {
    expect(rows).toBeTruthy()
    const types = (rows || []).map((r) => r.note_type)
    expect(types).toContain('pickup')
    expect(types).toContain('returned')
  } finally {
    await admin
      .from('walker_notes')
      .delete()
      .eq('walker_id', walkerId)
      .eq('dog_id', dog.id)
      .eq('walk_date', walkDate)
    await page.evaluate(() => localStorage.removeItem('wiggle_offline_queue'))
  }
})
