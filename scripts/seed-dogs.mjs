#!/usr/bin/env node
/**
 * Wiggle Dog Walks — Database seed script
 * Sets up profiles (3 roles), dogs table, RLS policies, and inserts 93 dogs from CSV.
 *
 * Usage: node scripts/seed-dogs.mjs
 * Requires: DATABASE_URL in .env.local
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Load DATABASE_URL from .env.local
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = resolve(ROOT, '.env.local');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Parse CSV
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = [];

  // Split into lines respecting quoted newlines
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  // Parse each line into fields
  for (const line of lines) {
    const fields = [];
    let field = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        q = !q;
      } else if (ch === ',' && !q) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    rows.push(fields);
  }

  return rows;
}

function loadDogs() {
  const csvPath = resolve(ROOT, 'wiggle_master_FINAL.csv');
  const text = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text);

  // First row is header
  const header = rows[0];
  const dogs = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue; // skip empty rows

    dogs.push({
      dog_name:    r[0] || null,
      sector:      r[1] || null,
      owner_first: r[2] || null,
      owner_last:  r[3] || null,
      breed:       r[4] || null,
      address:     r[5] || null,
      door_code:   r[6] || null,
      email:       r[7] || null,
      phone:       r[8] || null,
      notes:       r[9] || null,
      photo_url:   r[10] || null,
      bff:         r[11] || null,
      goals:       r[12] || null,
    });
  }

  return dogs;
}

// ---------------------------------------------------------------------------
// 3. Run it
// ---------------------------------------------------------------------------
async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase Postgres\n');

  try {
    // -----------------------------------------------------------------------
    // STEP 1: Update profiles table — 3 roles
    // -----------------------------------------------------------------------
    console.log('STEP 1 — Updating profiles table roles...');

    // Drop the old check constraint and add new one with 3 roles
    await client.query(`
      ALTER TABLE profiles
        DROP CONSTRAINT IF EXISTS profiles_role_check;
    `);
    await client.query(`
      ALTER TABLE profiles
        ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('admin', 'senior_walker', 'junior_walker'));
    `);
    // Migrate existing 'walker' rows to 'senior_walker'
    const migrated = await client.query(`
      UPDATE profiles SET role = 'senior_walker' WHERE role = 'walker';
    `);
    console.log(`  Migrated ${migrated.rowCount} walker(s) → senior_walker`);
    console.log('  Roles now: admin, senior_walker, junior_walker');

    // Update default
    await client.query(`
      ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'junior_walker';
    `);
    console.log('  Default role set to junior_walker\n');

    // -----------------------------------------------------------------------
    // STEP 2: Drop + recreate dogs table
    // -----------------------------------------------------------------------
    console.log('STEP 2 — Recreating dogs table...');

    // Drop policies first (they reference the table)
    await client.query(`DROP POLICY IF EXISTS "dogs_walker_read" ON dogs;`);
    await client.query(`DROP POLICY IF EXISTS "dogs_admin_write" ON dogs;`);
    await client.query(`DROP POLICY IF EXISTS "dogs_admin_all" ON dogs;`);
    await client.query(`DROP POLICY IF EXISTS "dogs_senior_read" ON dogs;`);
    await client.query(`DROP POLICY IF EXISTS "dogs_senior_write" ON dogs;`);
    await client.query(`DROP POLICY IF EXISTS "dogs_junior_read" ON dogs;`);

    await client.query(`DROP TABLE IF EXISTS walk_logs CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS dogs CASCADE;`);

    await client.query(`
      CREATE TABLE dogs (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        dog_name     text        NOT NULL,
        sector       text        CHECK (sector IN ('Plateau', 'Laurier')),
        owner_first  text,
        owner_last   text,
        breed        text,
        address      text,
        door_code    text,
        email        text,
        phone        text,
        notes        text,
        photo_url    text,
        bff          text,
        goals        text,
        created_at   timestamptz DEFAULT now(),
        updated_at   timestamptz DEFAULT now()
      );
    `);

    await client.query(`CREATE INDEX ON dogs (sector);`);
    await client.query(`CREATE INDEX ON dogs (dog_name);`);
    console.log('  dogs table created\n');

    // -----------------------------------------------------------------------
    // STEP 3: Recreate walk_logs (FK to dogs was dropped)
    // -----------------------------------------------------------------------
    console.log('STEP 3 — Recreating walk_logs table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS walk_logs (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        walker_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
        dog_id       uuid        NOT NULL REFERENCES dogs(id)     ON DELETE RESTRICT,
        walk_date    date        NOT NULL DEFAULT current_date,
        status       text        NOT NULL
                                 CHECK (status IN ('completed', 'skipped', 'incident')),
        notes        text,
        created_at   timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS walk_logs_walker_id_idx ON walk_logs (walker_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS walk_logs_dog_id_idx ON walk_logs (dog_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS walk_logs_walk_date_idx ON walk_logs (walk_date DESC);`);
    console.log('  walk_logs table created\n');

    // -----------------------------------------------------------------------
    // STEP 4: RLS policies (role-based)
    // -----------------------------------------------------------------------
    console.log('STEP 4 — Setting up RLS policies...');

    await client.query(`ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE walk_logs ENABLE ROW LEVEL SECURITY;`);

    // -- DOGS policies --

    // Admin: full CRUD
    await client.query(`
      CREATE POLICY "dogs_admin_all" ON dogs
        FOR ALL
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    `);

    // Senior walker: SELECT + INSERT + UPDATE (no DELETE)
    await client.query(`
      CREATE POLICY "dogs_senior_read" ON dogs
        FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "dogs_senior_insert" ON dogs
        FOR INSERT
        WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "dogs_senior_update" ON dogs
        FOR UPDATE
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);

    // Junior walker: SELECT only
    await client.query(`
      CREATE POLICY "dogs_junior_read" ON dogs
        FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'junior_walker');
    `);

    // -- WALK_LOGS policies --

    // Drop any existing
    await client.query(`DROP POLICY IF EXISTS "walk_logs_walker_insert" ON walk_logs;`);
    await client.query(`DROP POLICY IF EXISTS "walk_logs_read" ON walk_logs;`);
    await client.query(`DROP POLICY IF EXISTS "walk_logs_admin_write" ON walk_logs;`);
    await client.query(`DROP POLICY IF EXISTS "walk_logs_admin_all" ON walk_logs;`);
    await client.query(`DROP POLICY IF EXISTS "walk_logs_senior_read" ON walk_logs;`);
    await client.query(`DROP POLICY IF EXISTS "walk_logs_senior_write" ON walk_logs;`);
    await client.query(`DROP POLICY IF EXISTS "walk_logs_junior_read" ON walk_logs;`);

    // Admin: full CRUD
    await client.query(`
      CREATE POLICY "walk_logs_admin_all" ON walk_logs
        FOR ALL
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    `);

    // Senior walker: SELECT + INSERT + UPDATE
    await client.query(`
      CREATE POLICY "walk_logs_senior_read" ON walk_logs
        FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "walk_logs_senior_insert" ON walk_logs
        FOR INSERT
        WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "walk_logs_senior_update" ON walk_logs
        FOR UPDATE
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);

    // Junior walker: SELECT only
    await client.query(`
      CREATE POLICY "walk_logs_junior_read" ON walk_logs
        FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'junior_walker');
    `);

    console.log('  RLS policies created');
    console.log('    admin:         full CRUD on dogs + walk_logs');
    console.log('    senior_walker: SELECT/INSERT/UPDATE on dogs + walk_logs');
    console.log('    junior_walker: SELECT only on dogs + walk_logs\n');

    // -----------------------------------------------------------------------
    // STEP 5: Insert dogs from CSV
    // -----------------------------------------------------------------------
    console.log('STEP 5 — Inserting dogs from CSV...');

    const dogs = loadDogs();
    console.log(`  Parsed ${dogs.length} dogs from CSV`);

    for (const dog of dogs) {
      await client.query(
        `INSERT INTO dogs (dog_name, sector, owner_first, owner_last, breed, address, door_code, email, phone, notes, photo_url, bff, goals)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [dog.dog_name, dog.sector, dog.owner_first, dog.owner_last, dog.breed, dog.address, dog.door_code, dog.email, dog.phone, dog.notes, dog.photo_url, dog.bff, dog.goals]
      );
    }
    console.log('  All dogs inserted\n');

    // -----------------------------------------------------------------------
    // STEP 6: Verify
    // -----------------------------------------------------------------------
    console.log('STEP 6 — Verifying...');

    const { rows: countRows } = await client.query('SELECT count(*)::int AS total FROM dogs');
    const total = countRows[0].total;

    const { rows: sectorRows } = await client.query(
      'SELECT sector, count(*)::int AS n FROM dogs GROUP BY sector ORDER BY sector'
    );

    console.log(`  Total dogs: ${total}`);
    for (const r of sectorRows) {
      console.log(`    ${r.sector}: ${r.n}`);
    }

    if (total === 93) {
      console.log('\n  All 93 dogs loaded successfully!');
    } else {
      console.error(`\n  WARNING: Expected 93, got ${total}`);
    }

  } finally {
    await client.end();
    console.log('\nDone.');
  }
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
