#!/usr/bin/env node
/**
 * Wiggle Dog Walks — Database seed script
 * Sets up profiles (3 roles), dogs table, RLS policies, and inserts 93 dogs from CSV.
 *
 * SAFETY: Refuses to run if dogs table has data unless --force is passed.
 * With --force, creates a backup FIRST before wiping.
 *
 * Usage: node scripts/seed-dogs.mjs          (safe — refuses if table has data)
 *        node scripts/seed-dogs.mjs --force  (creates backup, then re-seeds)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FORCE = process.argv.includes('--force');

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

  const dogs = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;

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
// 3. Backup existing data before wipe
// ---------------------------------------------------------------------------
async function createBackup(client) {
  console.log('  Creating backup before wipe...');
  const { rows: dogs } = await client.query('SELECT * FROM dogs ORDER BY dog_name');
  const { rows: nameMap } = await client.query('SELECT * FROM acuity_name_map');

  const backup = {
    timestamp: new Date().toISOString(),
    reason: 'seed-dogs.mjs --force',
    dogs,
    acuity_name_map: nameMap,
  };

  const backupPath = resolve(ROOT, `backup_dogs_${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`  Backup saved: ${backupPath} (${dogs.length} dogs)\n`);

  // Also try to upload to Supabase Storage
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `dogs_backup_${dateStr}_force.json`;
      const body = JSON.stringify(backup);

      await fetch(`${supabaseUrl}/storage/v1/object/backups/${fileName}`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      console.log(`  Also uploaded to Storage: backups/${fileName}\n`);
    }
  } catch {
    console.log('  (Storage upload skipped — no service role key)\n');
  }

  return dogs.length;
}

// ---------------------------------------------------------------------------
// 4. Run it
// ---------------------------------------------------------------------------
async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase Postgres\n');

  try {
    // ─── SAFETY CHECK ─────────────────────────────────────────────────
    const { rows: countRows } = await client.query('SELECT count(*)::int AS total FROM dogs');
    const existingCount = countRows[0].total;

    if (existingCount > 0 && !FORCE) {
      console.log(`⚠️  Dogs table has ${existingCount} dogs. REFUSING to run.`);
      console.log(`   Use --force flag to override: node scripts/seed-dogs.mjs --force`);
      console.log(`   WARNING: --force will create a backup first, then wipe and re-seed.`);
      process.exit(1);
    }

    if (existingCount > 0 && FORCE) {
      console.log(`⚠️  --force flag detected. Table has ${existingCount} dogs.`);
      await createBackup(client);
    }

    // ─── Enable bypass for wipe protection ────────────────────────────
    await client.query(`SET LOCAL wiggle.allow_wipe = 'true'`);

    // Drop the event trigger so we can drop the table
    await client.query(`DROP EVENT TRIGGER IF EXISTS protect_dogs_drop`);

    // ───────────────────────────────────────────────────────────────────
    // STEP 1: Update profiles table — 3 roles
    // ───────────────────────────────────────────────────────────────────
    console.log('STEP 1 — Updating profiles table roles...');

    await client.query(`ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;`);
    await client.query(`
      ALTER TABLE profiles
        ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('admin', 'senior_walker', 'junior_walker'));
    `);
    const migrated = await client.query(`UPDATE profiles SET role = 'senior_walker' WHERE role = 'walker';`);
    console.log(`  Migrated ${migrated.rowCount} walker(s) → senior_walker`);
    await client.query(`ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'junior_walker';`);
    console.log('  Default role set to junior_walker\n');

    // ───────────────────────────────────────────────────────────────────
    // STEP 2: Drop + recreate dogs table
    // ───────────────────────────────────────────────────────────────────
    console.log('STEP 2 — Recreating dogs table...');

    // Drop policies
    for (const p of ['dogs_walker_read', 'dogs_admin_write', 'dogs_admin_all', 'dogs_senior_read',
                      'dogs_senior_write', 'dogs_senior_insert', 'dogs_senior_update', 'dogs_junior_read']) {
      await client.query(`DROP POLICY IF EXISTS "${p}" ON dogs;`);
    }

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
        updated_at   timestamptz DEFAULT now(),
        updated_by   text
      );
    `);

    await client.query(`CREATE INDEX ON dogs (sector);`);
    await client.query(`CREATE INDEX ON dogs (dog_name);`);
    console.log('  dogs table created\n');

    // ───────────────────────────────────────────────────────────────────
    // STEP 3: Recreate walk_logs
    // ───────────────────────────────────────────────────────────────────
    console.log('STEP 3 — Recreating walk_logs table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS walk_logs (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        walker_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
        dog_id       uuid        NOT NULL REFERENCES dogs(id)     ON DELETE RESTRICT,
        walk_date    date        NOT NULL DEFAULT current_date,
        status       text        NOT NULL CHECK (status IN ('completed', 'skipped', 'incident')),
        notes        text,
        created_at   timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS walk_logs_walker_id_idx ON walk_logs (walker_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS walk_logs_dog_id_idx ON walk_logs (dog_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS walk_logs_walk_date_idx ON walk_logs (walk_date DESC);`);
    console.log('  walk_logs table created\n');

    // ───────────────────────────────────────────────────────────────────
    // STEP 4: RLS policies
    // ───────────────────────────────────────────────────────────────────
    console.log('STEP 4 — Setting up RLS policies...');

    await client.query(`ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE walk_logs ENABLE ROW LEVEL SECURITY;`);

    // DOGS: Admin full CRUD
    await client.query(`
      CREATE POLICY "dogs_admin_all" ON dogs FOR ALL
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    `);
    // DOGS: Senior walker SELECT + INSERT + UPDATE
    await client.query(`
      CREATE POLICY "dogs_senior_read" ON dogs FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "dogs_senior_insert" ON dogs FOR INSERT
        WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "dogs_senior_update" ON dogs FOR UPDATE
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    // DOGS: Junior walker SELECT only
    await client.query(`
      CREATE POLICY "dogs_junior_read" ON dogs FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'junior_walker');
    `);

    // WALK_LOGS policies
    for (const p of ['walk_logs_walker_insert', 'walk_logs_read', 'walk_logs_admin_write',
                      'walk_logs_admin_all', 'walk_logs_senior_read', 'walk_logs_senior_write',
                      'walk_logs_senior_insert', 'walk_logs_senior_update', 'walk_logs_junior_read']) {
      await client.query(`DROP POLICY IF EXISTS "${p}" ON walk_logs;`);
    }

    await client.query(`
      CREATE POLICY "walk_logs_admin_all" ON walk_logs FOR ALL
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    `);
    await client.query(`
      CREATE POLICY "walk_logs_senior_read" ON walk_logs FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "walk_logs_senior_insert" ON walk_logs FOR INSERT
        WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "walk_logs_senior_update" ON walk_logs FOR UPDATE
        USING     ((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker')
        WITH CHECK((SELECT role FROM profiles WHERE id = auth.uid()) = 'senior_walker');
    `);
    await client.query(`
      CREATE POLICY "walk_logs_junior_read" ON walk_logs FOR SELECT
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'junior_walker');
    `);

    console.log('  RLS policies created\n');

    // ───────────────────────────────────────────────────────────────────
    // STEP 5: Insert dogs from CSV
    // ───────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────
    // STEP 6: Restore fortress protections
    // ───────────────────────────────────────────────────────────────────
    console.log('STEP 6 — Restoring fortress protections...');

    // Re-create audit trigger (was dropped with the table)
    await client.query(`
      CREATE OR REPLACE FUNCTION dogs_audit_fn()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO dogs_audit (dog_id, dog_name, action, changed_by, new_data)
          VALUES (NEW.id, NEW.dog_name, 'INSERT', coalesce(current_setting('request.jwt.claims', true)::json->>'email', current_user), to_jsonb(NEW));
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          INSERT INTO dogs_audit (dog_id, dog_name, action, changed_by, old_data, new_data)
          VALUES (NEW.id, NEW.dog_name, 'UPDATE', coalesce(current_setting('request.jwt.claims', true)::json->>'email', current_user), to_jsonb(OLD), to_jsonb(NEW));
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO dogs_audit (dog_id, dog_name, action, changed_by, old_data)
          VALUES (OLD.id, OLD.dog_name, 'DELETE', coalesce(current_setting('request.jwt.claims', true)::json->>'email', current_user), to_jsonb(OLD));
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      CREATE TRIGGER dogs_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON dogs
        FOR EACH ROW EXECUTE FUNCTION dogs_audit_fn();
    `);

    // Re-create truncate guard
    await client.query(`
      CREATE TRIGGER protect_dogs_truncate
        BEFORE TRUNCATE ON dogs
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_dogs_truncate();
    `);

    // Re-create drop guard event trigger
    await client.query(`
      CREATE EVENT TRIGGER protect_dogs_drop
        ON ddl_command_start
        WHEN TAG IN ('DROP TABLE')
        EXECUTE FUNCTION prevent_dogs_drop();
    `);

    console.log('  Audit trigger, truncate guard, drop guard restored\n');

    // ───────────────────────────────────────────────────────────────────
    // STEP 7: Verify
    // ───────────────────────────────────────────────────────────────────
    console.log('STEP 7 — Verifying...');

    const { rows: finalCount } = await client.query('SELECT count(*)::int AS total FROM dogs');
    const total = finalCount[0].total;

    const { rows: sectorRows } = await client.query(
      'SELECT sector, count(*)::int AS n FROM dogs GROUP BY sector ORDER BY sector'
    );

    const { rows: auditRows } = await client.query('SELECT count(*)::int AS n FROM dogs_audit');

    console.log(`  Total dogs: ${total}`);
    for (const r of sectorRows) console.log(`    ${r.sector}: ${r.n}`);
    console.log(`  Audit entries: ${auditRows[0].n}`);

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
