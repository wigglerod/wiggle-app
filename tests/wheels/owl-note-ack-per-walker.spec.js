// Wheel 1 — Bug 1: per-walker owl-note acknowledgement.
//
// Current production: tapping "Got it" updates last_acknowledged_date on the
// shared owl_notes row; every other walker's UI hides the note via realtime.
//
// After fix: ack is tracked in owl_note_acks (note_id, walker_id, ack_date).
// Walker A's ack must NOT hide the note for Walker B.

import { test, expect } from '@playwright/test'
import {
  admin,
  ensureTestWalker,
  loginAs,
  pickPlateauDog,
  clearOwlNotesForDog,
  TEST_WALKERS,
  sleep,
} from './_helpers.js'

async function openDogProfile(page, dogName) {
  // Walker can reach any dog profile from /dogs (DogsPage) regardless of today's events.
  await page.goto('/dogs')
  // The dog list renders dog names — click the one we seeded.
  const dogRow = page.getByText(new RegExp(`^${dogName}\\b`)).first()
  await dogRow.waitFor({ state: 'visible', timeout: 20_000 })
  await dogRow.click()
}

test('owl-note ack is per-walker — A acking does not hide the note for B', async ({ browser }) => {
  await ensureTestWalker(TEST_WALKERS.a)
  await ensureTestWalker(TEST_WALKERS.b)

  const dog = await pickPlateauDog()
  await clearOwlNotesForDog(dog.id)
  // Also clean any prior acks against this dog's notes.
  await admin.from('owl_note_acks').delete().eq('walker_id', (await admin.auth.admin.listUsers({ page: 1, perPage: 200 })).data.users.find((u) => u.email === TEST_WALKERS.a.email).id)

  const unique = String(Date.now())
  const noteText = `TEST per-walker ack ${unique}`
  const { data: inserted, error: insErr } = await admin
    .from('owl_notes')
    .insert({
      note_text: noteText,
      target_type: 'dog',
      target_dog_id: dog.id,
      target_dog_name: dog.dog_name,
      target_sector: dog.sector,
      // Duration tail makes this a "daily ack" note, which is the ack path under test.
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()
  if (insErr) throw new Error(`owl_notes insert: ${insErr.message}`)

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  try {
    await loginAs(pageA, TEST_WALKERS.a)
    await loginAs(pageB, TEST_WALKERS.b)

    await openDogProfile(pageA, dog.dog_name)
    await openDogProfile(pageB, dog.dog_name)

    // Both walkers see the note inside the drawer.
    await expect(pageA.getByText(noteText)).toBeVisible({ timeout: 15_000 })
    await expect(pageB.getByText(noteText)).toBeVisible({ timeout: 15_000 })

    // Walker A taps "Got it".
    await pageA.getByRole('button', { name: /^got it/i }).first().click()

    // Realtime propagation window.
    await sleep(4_000)

    // B must still see the note — this is the bug.
    await expect(pageB.getByText(noteText)).toBeVisible({ timeout: 5_000 })
  } finally {
    await contextA.close()
    await contextB.close()
    await admin.from('owl_note_acks').delete().eq('note_id', inserted.id)
    await admin.from('owl_notes').delete().eq('id', inserted.id)
  }
})
