import { getAdminClient } from './lib/supabase-admin.js'

/**
 * POST /api/tower-approve
 * Body: { id: uuid, status: 'approved' | 'rejected' }
 * Uses service role to bypass RLS for admin status updates.
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
    const { error } = await sb
      .from('mini_gen_drafts')
      .update({ status })
      .eq('id', id)

    if (error) throw error

    return res.status(200).json({ ok: true, id, status })
  } catch (e) {
    console.error('tower-approve error:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
