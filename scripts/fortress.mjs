#!/usr/bin/env node
/**
 * Wiggle Fortress — Database protection setup
 * Creates: audit table, audit trigger, truncate guard, drop guard, backups_log
 *
 * Usage: node scripts/fortress.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const lines = readFileSync(resolve(ROOT, '.env.local'), 'utf-8').split('\n');
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

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to Supabase Postgres\n');

  try {
    // ═══ 1. AUDIT TABLE ═══
    console.log('1. Creating dogs_audit table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS dogs_audit (
        id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        dog_id     uuid,
        dog_name   text,
        action     text        CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
        changed_by text,
        old_data   jsonb,
        new_data   jsonb,
        changed_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS dogs_audit_dog_id_idx ON dogs_audit (dog_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS dogs_audit_changed_at_idx ON dogs_audit (changed_at DESC);`);
    console.log('   done\n');

    // ═══ 2. AUDIT TRIGGER ═══
    console.log('2. Creating audit trigger on dogs...');
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

    await client.query(`DROP TRIGGER IF EXISTS dogs_audit_trigger ON dogs;`);
    await client.query(`
      CREATE TRIGGER dogs_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON dogs
        FOR EACH ROW
        EXECUTE FUNCTION dogs_audit_fn();
    `);
    console.log('   done\n');

    // ═══ 3. TRUNCATE GUARD ═══
    console.log('3. Creating TRUNCATE guard on dogs...');
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_dogs_truncate()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('wiggle.allow_wipe', true) = 'true' THEN
          RETURN NULL;
        END IF;
        RAISE EXCEPTION 'BLOCKED: Cannot truncate the dogs table. Use seed-dogs.mjs --force or set wiggle.allow_wipe=true.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`DROP TRIGGER IF EXISTS protect_dogs_truncate ON dogs;`);
    await client.query(`
      CREATE TRIGGER protect_dogs_truncate
        BEFORE TRUNCATE ON dogs
        FOR EACH STATEMENT
        EXECUTE FUNCTION prevent_dogs_truncate();
    `);
    console.log('   done\n');

    // ═══ 4. DROP TABLE GUARD ═══
    console.log('4. Creating DROP TABLE guard (event trigger)...');
    await client.query(`DROP EVENT TRIGGER IF EXISTS protect_dogs_drop;`);
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_dogs_drop()
      RETURNS event_trigger AS $$
      BEGIN
        IF current_setting('wiggle.allow_wipe', true) = 'true' THEN
          RETURN;
        END IF;
        IF current_query() ~* '\\mdogs\\M' THEN
          RAISE EXCEPTION 'BLOCKED: Cannot drop the dogs table. Use seed-dogs.mjs --force or set wiggle.allow_wipe=true.';
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      CREATE EVENT TRIGGER protect_dogs_drop
        ON ddl_command_start
        WHEN TAG IN ('DROP TABLE')
        EXECUTE FUNCTION prevent_dogs_drop();
    `);
    console.log('   done\n');

    // ═══ 5. BACKUPS LOG TABLE ═══
    console.log('5. Creating backups_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS backups_log (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        backup_date timestamptz DEFAULT now(),
        file_path   text,
        dog_count   int,
        status      text        CHECK (status IN ('success', 'failed')),
        details     text
      );
    `);
    console.log('   done\n');

    // ═══ 6. ENABLE RLS on new tables ═══
    console.log('6. Enabling RLS on audit + backup tables...');
    await client.query(`ALTER TABLE dogs_audit ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE backups_log ENABLE ROW LEVEL SECURITY;`);

    // Admin can read audit + backups
    for (const table of ['dogs_audit', 'backups_log']) {
      await client.query(`DROP POLICY IF EXISTS "${table}_admin_all" ON ${table};`);
      await client.query(`
        CREATE POLICY "${table}_admin_all" ON ${table}
          FOR ALL
          USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
          WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
      `);
    }
    console.log('   done\n');

    // ═══ 7. VERIFY ═══
    console.log('═══ VERIFICATION ═══');

    const { rows: auditCount } = await client.query('SELECT count(*)::int AS n FROM dogs_audit');
    console.log(`  dogs_audit rows: ${auditCount[0].n}`);

    const { rows: backupCount } = await client.query('SELECT count(*)::int AS n FROM backups_log');
    console.log(`  backups_log rows: ${backupCount[0].n}`);

    // Test truncate guard
    try {
      await client.query('TRUNCATE dogs');
      console.log('  TRUNCATE guard: FAILED (truncate was allowed!)');
    } catch (err) {
      if (err.message.includes('BLOCKED')) {
        console.log('  TRUNCATE guard: PASSED (blocked as expected)');
      } else {
        console.log(`  TRUNCATE guard: ERROR — ${err.message}`);
      }
    }

    // Test drop guard
    try {
      await client.query('DROP TABLE dogs');
      console.log('  DROP guard: FAILED (drop was allowed!)');
    } catch (err) {
      if (err.message.includes('BLOCKED')) {
        console.log('  DROP guard: PASSED (blocked as expected)');
      } else {
        console.log(`  DROP guard: ERROR — ${err.message}`);
      }
    }

    // Verify dogs still exist
    const { rows: dogCount } = await client.query('SELECT count(*)::int AS n FROM dogs');
    console.log(`  dogs table: ${dogCount[0].n} dogs (safe!)`);

    console.log('\nFortress setup complete.');

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fortress setup failed:', err.message);
  process.exit(1);
});
