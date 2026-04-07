import { getAdminClient } from './lib/supabase-admin.js'

/**
 * POST /api/tower-add-name-map
 * Body: { acuity_name: string, dog_name: string }
 *
 * Verifies dog_name exists in dogs table, then inserts into acuity_name_map.
 * ON CONFLICT DO NOTHING (won't duplicate existing mappings).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { acuity_name, dog_name } = req.body || {}

  if (!acuity_name || !dog_name) {
    return res.status(400).json({ error: 'Missing acuity_name or dog_name' })
  }

  try {
    const sb = getAdminClient()

    // Verify dog_name exists in dogs table
    const { data: dog, error: lookupError } = await sb
      .from('dogs')
      .select('id')
      .eq('dog_name', dog_name)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!dog) {
      return res.status(400).json({ error: `Dog "${dog_name}" not found` })
    }

    // Insert mapping — ON CONFLICT DO NOTHING
    const { error: insertError } = await sb
      .from('acuity_name_map')
      .upsert(
        { acuity_name, dog_name, acuity_email: '' },
        { onConflict: 'acuity_name,acuity_email', ignoreDuplicates: true }
      )

    if (insertError) throw insertError

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('tower-add-name-map error:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
