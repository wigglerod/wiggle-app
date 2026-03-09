import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = '/Users/galvan/Documents/wiggle-app';

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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  // 1. Seed acuity_name_map
  console.log('Seeding acuity_name_map...');

  // Ensure table exists and acuity_email allows NULL
  await client.query(`
    CREATE TABLE IF NOT EXISTS acuity_name_map (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      acuity_name text NOT NULL,
      dog_name    text NOT NULL,
      acuity_email text,
      created_at  timestamptz DEFAULT now(),
      UNIQUE(acuity_name, acuity_email)
    );
  `);
  await client.query(`ALTER TABLE acuity_name_map ALTER COLUMN acuity_email DROP NOT NULL;`);

  // Clear existing and insert fresh
  await client.query('DELETE FROM acuity_name_map');

  const mappings = [
    ['Halloumi (Pauline)', 'Halloumi', null],
    ['Chessy', 'Cheesy', null],
    ['Django Dali', 'Django and Dali', null],
    ['Enzo', 'Enzo OG', 'avm.00@outlook.com'],
    ['Papi Chulo', 'Papi Chulo', null],
  ];

  for (const [acuity, dog, email] of mappings) {
    await client.query(
      'INSERT INTO acuity_name_map (acuity_name, dog_name, acuity_email) VALUES ($1, $2, $3)',
      [acuity, dog, email]
    );
  }

  const { rows: mapCount } = await client.query('SELECT count(*)::int AS n FROM acuity_name_map');
  console.log(`  acuity_name_map: ${mapCount[0].n} entries`);

  // 2. SQL updates for Enzo OG and Luna GS
  console.log('\nUpdating Enzo OG address...');
  const r1 = await client.query(`UPDATE dogs SET address = '5412 Rue Garnier' WHERE dog_name = 'Enzo OG'`);
  console.log(`  Updated ${r1.rowCount} row(s)`);

  console.log('Updating Luna GS profile...');
  const r2 = await client.query(`
    UPDATE dogs
    SET address = '5327 Rue Saint-Andre',
        door_code = '514880',
        notes = 'Dog reactive',
        bff = 'Maya, Lou, Alba, Enzo',
        breed = 'German Shepherd'
    WHERE dog_name = 'Luna GS'
  `);
  console.log(`  Updated ${r2.rowCount} row(s)`);

  // 3. Verify counts
  console.log('\n--- VERIFICATION ---');
  const { rows: dogCount } = await client.query('SELECT count(*)::int AS n FROM dogs');
  console.log(`dogs: ${dogCount[0].n}`);

  const { rows: sectorCount } = await client.query('SELECT sector, count(*)::int AS n FROM dogs GROUP BY sector ORDER BY sector');
  for (const r of sectorCount) console.log(`  ${r.sector}: ${r.n}`);

  const { rows: nameMapFinal } = await client.query('SELECT count(*)::int AS n FROM acuity_name_map');
  console.log(`acuity_name_map: ${nameMapFinal[0].n}`);

  // Show the name map entries
  const { rows: mapRows } = await client.query('SELECT acuity_name, dog_name, acuity_email FROM acuity_name_map ORDER BY acuity_name');
  for (const r of mapRows) {
    console.log(`  "${r.acuity_name}" → "${r.dog_name}"${r.acuity_email ? ` (${r.acuity_email})` : ''}`);
  }

  // Verify specific dogs
  const { rows: enzo } = await client.query("SELECT dog_name, address FROM dogs WHERE dog_name = 'Enzo OG'");
  console.log(`\nEnzo OG address: ${enzo[0]?.address}`);

  const { rows: luna } = await client.query("SELECT dog_name, address, door_code, notes, bff, breed FROM dogs WHERE dog_name = 'Luna GS'");
  console.log(`Luna GS: addr=${luna[0]?.address}, door=${luna[0]?.door_code}, notes=${luna[0]?.notes}, bff=${luna[0]?.bff}, breed=${luna[0]?.breed}`);

} finally {
  await client.end();
  console.log('\nDone.');
}
