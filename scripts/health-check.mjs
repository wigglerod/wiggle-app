import pg from 'pg'
import { readFileSync } from 'fs'

const envText = readFileSync('.env.local', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2]
}

const ACUITY_USER_ID = process.env.ACUITY_USER_ID
const ACUITY_API_KEY = process.env.ACUITY_API_KEY
const auth = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64')

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function fetchAcuity(date) {
  const url = `https://acuityscheduling.com/api/v1/appointments?minDate=${date}&maxDate=${date}&canceled=false`
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) throw new Error(`Acuity ${res.status}`)
  return res.json()
}

function toDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}

async function run() {
  await client.connect()

  // Load dogs + name map
  const dogsRes = await client.query('SELECT * FROM dogs ORDER BY dog_name')
  const dogs = dogsRes.rows
  const mapRes = await client.query('SELECT acuity_name, dog_name, acuity_email FROM acuity_name_map')

  // Build name map (same logic as the app)
  const nameMap = new Map()
  for (const row of mapRes.rows) {
    const key = row.acuity_name.toLowerCase().trim()
    if (!nameMap.has(key)) nameMap.set(key, [])
    nameMap.get(key).push({
      dogName: row.dog_name.trim(),
      email: row.acuity_email?.trim() || null,
    })
  }

  function lookupNameMap(name, eventEmail) {
    const entries = nameMap.get(name.toLowerCase().trim())
    if (!entries) return null
    if (eventEmail) {
      const emailLower = eventEmail.toLowerCase().trim()
      const emailMatch = entries.find(e => e.email === emailLower)
      if (emailMatch) return emailMatch.dogName
    }
    const generic = entries.find(e => !e.email)
    return generic ? generic.dogName : null
  }

  function matchByName(name) {
    const n = name.toLowerCase().trim()
    const exact = dogs.find(d => d.dog_name.toLowerCase().trim() === n)
    if (exact) return exact
    return null
  }

  // Fetch this week's appointments
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))

  const allEvents = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = toDateStr(d)
    const appts = await fetchAcuity(dateStr)
    for (const a of appts) {
      allEvents.push({
        summary: `${a.firstName} ${a.lastName}`.trim(),
        email: a.email,
        phone: a.phone,
        firstName: a.firstName,
        lastName: a.lastName,
        sector: a.calendar,
        start: a.datetime,
      })
    }
  }

  console.log(`\n=== HEALTH CHECK ===`)
  console.log(`Dogs in DB: ${dogs.length}`)
  console.log(`Acuity appointments this week: ${allEvents.length}`)
  console.log(`Name map entries: ${mapRes.rows.length}\n`)

  let matched = 0, unmatched = 0, sectorMismatches = 0

  for (const ev of allEvents) {
    const name = (ev.summary || '').trim().split(/\s+/)[0]
    const titleName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()

    // Try name map first (with email)
    let dogName = lookupNameMap(titleName, ev.email)
    let dog = dogName ? matchByName(dogName) : null
    let method = dogName ? 'name_map' : null

    // Try exact name match
    if (!dog) {
      dog = matchByName(titleName)
      method = dog ? 'dog_name' : null
    }

    // Try email match
    if (!dog && ev.email) {
      const emailLower = ev.email.toLowerCase().trim()
      dog = dogs.find(d => d.email && d.email.toLowerCase().trim() === emailLower)
      method = dog ? 'email' : null
    }

    if (dog) {
      matched++
      // Check sector mismatch
      if (dog.sector && ev.sector && dog.sector !== ev.sector) {
        sectorMismatches++
        console.log(`  SECTOR MISMATCH: ${dog.dog_name} (${dog.sector}) booked under ${ev.sector} via ${method}`)
      }
    } else {
      unmatched++
      console.log(`  UNMATCHED: "${ev.summary}" (${ev.email || 'no email'})`)
    }
  }

  console.log(`\n--- RESULTS ---`)
  console.log(`Matched: ${matched}/${allEvents.length}`)
  console.log(`Unmatched: ${unmatched}`)
  console.log(`Sector mismatches: ${sectorMismatches}`)

  // Verify Luna GS profile
  const lunaGS = await client.query(`SELECT dog_name, sector, breed, address, door_code, notes, bff FROM dogs WHERE dog_name = 'Luna GS'`)
  if (lunaGS.rows.length) {
    const l = lunaGS.rows[0]
    console.log(`\n--- LUNA GS PROFILE ---`)
    console.log(`  Name: ${l.dog_name}`)
    console.log(`  Sector: ${l.sector}`)
    console.log(`  Breed: ${l.breed}`)
    console.log(`  Address: ${l.address}`)
    console.log(`  Door code: ${l.door_code}`)
    console.log(`  Notes: ${l.notes}`)
    console.log(`  BFF: ${l.bff}`)
  }

  await client.end()
}

run().catch((err) => { console.error(err); process.exit(1) })
