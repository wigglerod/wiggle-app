import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
  }

  console.log('Testing profiles table RLS via REST API...\n')

  // Test 1: Can we read profiles with the anon key (unauthenticated)?
  const anonResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,sector&limit=5`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    }
  })
  const anonData = await anonResp.json()
  console.log('Anon read result (limit 5):')
  if (Array.isArray(anonData)) {
    if (anonData.length === 0) {
      console.log('  -> Got empty array. RLS is blocking anon reads OR table is empty.')
    } else {
      console.log('  -> OK, got', anonData.length, 'rows:', anonData.map(r => r.full_name).join(', '))
    }
  } else {
    console.log('  -> Error:', JSON.stringify(anonData))
    if (anonData?.code === 'PGRST301' || anonData?.message?.includes('RLS')) {
      console.log('\n  ⚠️  RLS is blocking reads. Run scripts/add-profiles-rls.sql in the Supabase SQL editor.')
    }
  }

  // Test 2: Sector filter with Rodrigo special case
  console.log('\nTesting sector filter query (Laurier + both/Rodrigo):')
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,role,sector&or=(sector.eq.Laurier,and(sector.eq.both,full_name.ilike.Rodrigo*))&full_name=not.is.null&full_name=not.in.(Gen,Wiggle%20Pro,Pup%20Walker)&order=full_name`,
    {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      }
    }
  )
  const data = await resp.json()
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('  -> Empty. Either RLS blocks reads or no matching profiles.')
      console.log('\n  ⚠️  Run scripts/add-profiles-rls.sql in the Supabase SQL editor to fix RLS.')
    } else {
      console.log('  -> OK! Got:', data.map(r => `${r.full_name} (${r.sector})`).join(', '))
    }
  } else {
    console.log('  -> Error:', JSON.stringify(data))
  }
}
main()
