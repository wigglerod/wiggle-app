// Wheel 1 — Bug 2: stale untailed owl notes are not visible today.
//
// Current production: an owl note inserted with NULL expires_at and a past
// scheduled_date lingers forever. The load filter only excludes notes with
// scheduled_date > today (future) or expired expires_at (NULL is not expired).
//
// After fix: load filter treats (expires_at IS NULL AND scheduled_date < today)
// as stale. New inserts go through createNote, which sets expires_at to EOD
// in America/Toronto.

import { test, expect } from '@playwright/test'
import {
  admin,
  ensureTestWalker,
  loginAs,
  pickPlateauDog,
  clearOwlNotesForDog,
  TEST_WALKERS,
  yesterdayInToronto,
} from './_helpers.js'

async function openDogProfile(page, dogName) {
  await page.goto('/dogs')
  const dogRow = page.getByText(new RegExp(`^${dogName}\\b`)).first()
  await dogRow.waitFor({ state: 'visible', timeout: 20_000 })
  await dogRow.click()
}

test("yesterday's untailed owl note with NULL expires_at is not visible today", async ({ page }) => {
  await ensureTestWalker(TEST_WALKERS.a)
  const dog = await pickPlateauDog()
  await clearOwlNotesForDog(dog.id)

  const noteText = `TEST yesterday untailed ${Date.now()}`
  const yesterday = yesterdayInToronto()

  const { data: inserted, error: insErr } = await admin
    .from('owl_notes')
    .insert({
      note_text: noteText,
      target_type: 'dog',
      target_dog_id: dog.id,
      target_dog_name: dog.dog_name,
      target_sector: dog.sector,
      scheduled_date: yesterday,
      expires_at: null, // the bug-trigger condition: writer never set a default
    })
    .select()
    .single()
  if (insErr) throw new Error(`owl_notes insert: ${insErr.message}`)

  try {
    await loginAs(page, TEST_WALKERS.a)
    await openDogProfile(page, dog.dog_name)
    // Yesterday's note must NOT appear.
    await expect(page.getByText(noteText)).toHaveCount(0, { timeout: 8_000 })
  } finally {
    await admin.from('owl_notes').delete().eq('id', inserted.id)
  }
})
