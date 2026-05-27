// Provision the two Plateau test walker accounts (idempotent).
// Run with: node tests/wheels/_provision.mjs
import { ensureTestWalker, TEST_WALKERS } from './_helpers.js'

const aId = await ensureTestWalker(TEST_WALKERS.a)
const bId = await ensureTestWalker(TEST_WALKERS.b)
console.log('test_walker_plateau_a:', aId)
console.log('test_walker_plateau_b:', bId)
