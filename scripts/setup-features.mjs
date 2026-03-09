#!/usr/bin/env node
/**
 * Wiggle — Set up storage bucket, daily_notes table, and updated_by column
 * Usage: node scripts/setup-features.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
}

loadEnv()

const DATABASE_URL = process.env.DATABASE_URL
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1) }

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to Supabase Postgres\n')

  try {
    // ── STEP 1: Create dog-photos storage bucket ──
    console.log('STEP 1 — Creating dog-photos storage bucket...')
    const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        id: 'dog-photos',
        name: 'dog-photos',
        public: true,
        file_size_limit: 5242880,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
      }),
    })

    if (bucketRes.ok) {
      console.log('  ✓ dog-photos bucket created')
    } else {
      const err = await bucketRes.json().catch(() => ({}))
      if (JSON.stringify(err).includes('already exists')) {
        console.log('  ✓ dog-photos bucket already exists')
      } else {
        console.warn('  ⚠ Bucket creation:', err.message || err.error || bucketRes.status)
      }
    }

    // ── STEP 2: Storage policies ──
    console.log('\nSTEP 2 — Setting up storage policies...')

    await client.query(`
      DO $$ BEGIN
        CREATE POLICY "dog_photos_read" ON storage.objects
          FOR SELECT USING (bucket_id = 'dog-photos');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    console.log('  ✓ Read policy (public)')

    await client.query(`
      DO $$ BEGIN
        CREATE POLICY "dog_photos_upload" ON storage.objects
          FOR INSERT
          WITH CHECK (
            bucket_id = 'dog-photos'
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'senior_walker')
          );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    console.log('  ✓ Upload policy (admin + senior_walker)')

    await client.query(`
      DO $$ BEGIN
        CREATE POLICY "dog_photos_update" ON storage.objects
          FOR UPDATE
          USING (
            bucket_id = 'dog-photos'
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'senior_walker')
          );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    console.log('  ✓ Update policy (admin + senior_walker)')

    await client.query(`
      DO $$ BEGIN
        CREATE POLICY "dog_photos_delete" ON storage.objects
          FOR DELETE
          USING (
            bucket_id = 'dog-photos'
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'senior_walker')
          );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    console.log('  ✓ Delete policy (admin + senior_walker)')

    // ── STEP 3: Add updated_by to dogs ──
    console.log('\nSTEP 3 — Adding updated_by column to dogs...')
    await client.query(`ALTER TABLE dogs ADD COLUMN IF NOT EXISTS updated_by text;`)
    console.log('  ✓ updated_by column added')

    // ── STEP 4: Create daily_notes table ──
    console.log('\nSTEP 4 — Creating daily_notes table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_notes (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        note_text   text        NOT NULL,
        created_by  uuid        NOT NULL REFERENCES profiles(id),
        note_date   date        NOT NULL DEFAULT current_date,
        created_at  timestamptz NOT NULL DEFAULT now(),
        UNIQUE(note_date)
      );
    `)
    console.log('  ✓ daily_notes table created')

    await client.query(`ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;`)

    await client.query(`
      DO $$ BEGIN
        CREATE POLICY "daily_notes_read" ON daily_notes
          FOR SELECT USING (auth.uid() IS NOT NULL);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    console.log('  ✓ Read policy for daily_notes (all authenticated)')

    await client.query(`
      DO $$ BEGIN
        CREATE POLICY "daily_notes_admin_write" ON daily_notes
          FOR ALL
          USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
          WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    console.log('  ✓ Write policy for daily_notes (admin only)')

    console.log('\n✅ All setup complete!')

  } finally {
    await client.end()
    console.log('Done.')
  }
}

main().catch(err => {
  console.error('Script failed:', err.message)
  process.exit(1)
})
