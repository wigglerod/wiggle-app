// Wheel 1 — Bug 3: walk_groups realtime ignores DELETE events.
//
// Current production: useWalkGroups handler reads payload.new and returns
// early. On a DELETE, payload.new is null and the deleted group lingers in
// the walker's UI until a manual reload.
//
// After fix: DELETE branch removes the row from groupNums/groups/groupNames/
// groupLocks/walkerAssignments and rebuilds unassigned.

import { test, expect } from '@playwright/test'
import {
  admin,
  ensureTestWalker,
  loginAs,
  TEST_WALKERS,
  todayInToronto,
  getMaxGroupNum,
  sleep,
} from './_helpers.js'

test('walk_groups DELETE event removes group from walker view without reload', async ({ page }) => {
  await ensureTestWalker(TEST_WALKERS.a)
  const walkDate = todayInToronto()
  const sector = 'Plateau'

  const startMax = await getMaxGroupNum(walkDate, sector)
  const groupNum = startMax + 1
  const markerName = `TEST_GROUP_${Date.now()}`

  // Insert a test group via service role.
  const { data: inserted, error: insErr } = await admin
    .from('walk_groups')
    .insert({
      walk_date: walkDate,
      group_num: groupNum,
      sector,
      dog_ids: [],
      group_name: markerName,
      walker_id: null,
      walker_ids: null,
      locked: false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (insErr) throw new Error(`walk_groups insert: ${insErr.message}`)

  try {
    await loginAs(page, TEST_WALKERS.a)

    // Navigate to today's view. Default route is Dashboard with today.
    // The new group should appear by name or by number badge.
    await expect(page.getByText(markerName)).toBeVisible({ timeout: 20_000 })

    // ── Delete via service role ───────────────────────────────────────────
    const { error: delErr } = await admin
      .from('walk_groups')
      .delete()
      .eq('id', inserted.id)
    if (delErr) throw new Error(`walk_groups delete: ${delErr.message}`)

    // Wait for realtime to propagate.
    await sleep(4_000)

    // ── Assertion: group is no longer visible without reload ──────────────
    await expect(page.getByText(markerName)).toHaveCount(0, { timeout: 5_000 })

    // And the group_num row matches DB state.
    const afterMax = await getMaxGroupNum(walkDate, sector)
    expect(afterMax).toBeLessThan(groupNum)
  } finally {
    // Best-effort cleanup in case the test exited mid-flight.
    await admin
      .from('walk_groups')
      .delete()
      .eq('walk_date', walkDate)
      .eq('sector', sector)
      .eq('group_num', groupNum)
  }
})
