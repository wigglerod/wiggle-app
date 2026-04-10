import { getAdminClient } from './lib/supabase-admin.js'

/**
 * POST /api/tower-approve
 * Body: { id: uuid, status: 'approved' | 'rejected' }
 *
 * approved  → updates mini_gen_drafts status + promotes dogs into walk_groups
 * rejected  → updates mini_gen_drafts status only
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id, status } = req.body || {}

  if (!id || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Missing id or invalid status' })
  }

  try {
    const sb = getAdminClient()

    // 1. Update draft status
    const { error: updateError } = await sb
      .from('mini_gen_drafts')
      .update({ status })
      .eq('id', id)

    if (updateError) throw updateError

    // Rejected → done, no promote
    if (status === 'rejected') {
      return res.status(200).json({ ok: true, id, status })
    }

    // 2. Read the approved draft
    const { data: draft, error: readError } = await sb
      .from('mini_gen_drafts')
      .select('dog_names, walk_date, sector')
      .eq('id', id)
      .single()

    if (readError) throw readError

    const { dog_names, walk_date, sector } = draft

    if (!dog_names || dog_names.length === 0) {
      return res.status(200).json({ ok: true, id, status, promoted: 0, skipped: 0 })
    }

    // 3. Get current max group_num for this walk_date + sector
    const { data: maxRow, error: maxError } = await sb
      .from('walk_groups')
      .select('group_num')
      .eq('walk_date', walk_date)
      .eq('sector', sector)
      .order('group_num', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxError) throw maxError

    let nextGroupNum = (maxRow?.group_num || 0) + 1
    let promoted = 0
    let skipped = 0

    // 4. Insert one walk_groups row per dog (with idempotency check)
    for (const dogName of dog_names) {
      // Idempotency: skip if this dog already has a row for this date + sector
      const { data: existing, error: checkError } = await sb
        .from('walk_groups')
        .select('id')
        .eq('walk_date', walk_date)
        .eq('sector', sector)
        .contains('dog_ids', [dogName])
        .limit(1)
        .maybeSingle()

      if (checkError) throw checkError

      if (existing) {
        skipped++
        continue
      }

      const { error: insertError } = await sb
        .from('walk_groups')
        .insert({
          walk_date,
          sector,
          group_num: nextGroupNum,
          group_name: null,
          dog_ids: [dogName],
          walker_ids: [],
          locked: false,
          locked_by: null,
          locked_by_name: null,
          dog_order: null,
        })

      if (insertError) throw insertError

      nextGroupNum++
      promoted++
    }

    return res.status(200).json({ ok: true, id, status, promoted, skipped })
  } catch (e) {
    console.error('tower-approve error:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
