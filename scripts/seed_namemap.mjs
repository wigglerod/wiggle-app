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
    // Manual overrides (misspellings, alternate names)
    ['Halloumi (Pauline)', 'Halloumi', null],
    ['Chessy', 'Cheesy', null],
    ['Django Dali', 'Django and Dali', null],
    ['Papi Chulo', 'Papi Chulo', null],
    ['Maxime', 'Muji', null],
    ['Mina', 'Paloma', null],
    ['Lou', 'Lou Bouvier', null],
    ['Cleo', 'Cleo Golden', null],
    ['Léa', 'Lea', null],
    ['Pippin', 'Pippen', null],
    ['Indie', 'Indie Lab', null],
    ['Alissa', 'Brindu', null],

    // Email-conditional: Enzo disambiguation
    ['Enzo', 'Enzo OG', 'avm.00@outlook.com'],

    // Email-conditional: Pepper disambiguation
    ['Pepper', 'Pepper Husky', 'cdbarrie@gmail.com'],
    ['Pepper', 'Pepper Mini Aussie', 'hey@quinnkeast.com'],

    // Email-conditional: Luna disambiguation
    ['Luna', 'Luna GS', 'rgodbout66@gmail.com'],
    ['Luna', 'Luna GS', 'rgodbout@hotmail.com'],
    ['Luna', 'Luna', 'beaudoin.florence23@gmail.com'],
    ['Luna/Florence', 'Luna', 'beaudoin.florence23@gmail.com'],

    // Multi-dog households that should NOT be split
    ['Loupette et Luna', 'Loupette et Luna', null],
    ['Dante and Enzo', 'Dante and Enzo', null],
  ];

  for (const [acuity, dog, email] of mappings) {
    await client.query(
      'INSERT INTO acuity_name_map (acuity_name, dog_name, acuity_email) VALUES ($1, $2, $3)',
      [acuity, dog, email]
    );
  }

  const { rows: mapCount } = await client.query('SELECT count(*)::int AS n FROM acuity_name_map');
  console.log(`  acuity_name_map: ${mapCount[0].n} entries`);

  // 2. Sync emails in dogs table to match Acuity
  console.log('\nSyncing dog emails...');
  const emailUpdates = [
    ['Gustav', 'alallo@gmail.com, g.arcand@gmail.com'],
    ['Lupo', 'amandavincelli@gmail.com'],
    ['Enzo OG', 'avm.00@outlook.com'],
    ['Maya', 'brohart@gmail.com'],
    ['Scotch', 'j_morgia@hotmail.com'],
    ['Josie', 'lbenaiteau@gmail.com'],
    ['Muji', 'maxime@cafepista.com'],
    ['Lola', 'nisenson@videotron.ca'],
    ['Halloumi', 'ppestre@hotmail.com, rigel.zifkin@gmail.com'],
    ['Lucky', 'reessamu@gmail.com, livthomson.nz@gmail.com'],
    ['Luna GS', 'rgodbout66@gmail.com'],
    ['Brindu', 'adkoski@gmail.com'],
  ];
  for (const [dog, email] of emailUpdates) {
    const r = await client.query('UPDATE dogs SET email = $1 WHERE dog_name = $2', [email, dog]);
    console.log(`  ${dog}: ${r.rowCount ? 'OK' : 'NOT FOUND'}`);
  }

  // 3. Fix addresses
  console.log('\nUpdating addresses...');
  const r1 = await client.query(`UPDATE dogs SET address = '5046 Rue Garnier H2J 3S9', door_code = '1212' WHERE dog_name = 'Pepper Husky'`);
  console.log(`  Pepper Husky: ${r1.rowCount ? 'OK' : 'NOT FOUND'}`);
  const r2 = await client.query(`UPDATE dogs SET address = '1129 Rue Rachel Est' WHERE dog_name = 'Pepper Mini Aussie'`);
  console.log(`  Pepper Mini Aussie: ${r2.rowCount ? 'OK' : 'NOT FOUND'}`);
  const r3 = await client.query(`UPDATE dogs SET address = '4332 Rue Saint-Hubert' WHERE dog_name = 'Brindu'`);
  console.log(`  Brindu: ${r3.rowCount ? 'OK' : 'NOT FOUND'}`);

  // Enzo OG + Luna GS profile updates
  await client.query(`UPDATE dogs SET address = '5412 Rue Garnier' WHERE dog_name = 'Enzo OG'`);
  await client.query(`
    UPDATE dogs
    SET address = '5327 Rue Saint-Andre',
        door_code = '514880',
        notes = 'Dog reactive',
        bff = 'Maya, Lou, Alba, Enzo',
        breed = 'German Shepherd'
    WHERE dog_name = 'Luna GS'
  `);

  // 4. Add Miyagi (if not exists)
  console.log('\nChecking new dogs...');
  const miyagi = await client.query(`
    INSERT INTO dogs (dog_name, sector, owner_first, owner_last, email, address, breed)
    SELECT 'Miyagi', 'Laurier', 'Amber', 'Johnson', 'arosejohnson1@gmail.com', '4305 Avenue Des Erables Apt A', 'Mixed'
    WHERE NOT EXISTS (SELECT 1 FROM dogs WHERE dog_name = 'Miyagi')
    RETURNING dog_name
  `);
  console.log(`  Miyagi: ${miyagi.rowCount ? 'INSERTED' : 'already exists'}`);

  // 5. Add Cynthia placeholder (if not exists)
  const cynthia = await client.query(`
    INSERT INTO dogs (dog_name, sector, owner_first, owner_last, email, address, notes)
    SELECT 'Cynthia Dog TBD', 'Plateau', 'Cynthia', 'Fish', 'cfishfr@yahoo.com', '4065 Rue Drolet H2W2L5', 'NEW CLIENT — dog name coming'
    WHERE NOT EXISTS (SELECT 1 FROM dogs WHERE email = 'cfishfr@yahoo.com')
    RETURNING dog_name
  `);
  console.log(`  Cynthia Dog TBD: ${cynthia.rowCount ? 'INSERTED' : 'already exists'}`);

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
