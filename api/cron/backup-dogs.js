import { getAdminClient } from '../lib/supabase-admin.js'

/**
 * Nightly Database Backup — runs at 2 AM Eastern (6 AM UTC) daily.
 * Backs up: dogs, acuity_name_map, walk_groups, walk_logs
 * Uploads JSON to Supabase Storage "backups" bucket.
 * Cleans up backups older than 30 days.
 *
 * Also usable as a manual backup via POST /api/cron/backup-dogs?manual=true
 */
export default async function handler(req, res) {
  // Auth: Vercel cron header OR manual trigger with service key
  const isManual = req.query.manual === 'true'
  const cronSecret = process.env.CRON_SECRET
  if (!isManual && cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getAdminClient()
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '')
  const fileName = `dogs_backup_${dateStr}_${timeStr}.json`

  try {
    // Fetch all tables
    const [dogsRes, nameMapRes, walkGroupsRes, walkLogsRes] = await Promise.all([
      supabase.from('dogs').select('*').order('dog_name'),
      supabase.from('acuity_name_map').select('*'),
      supabase.from('walk_groups').select('*').order('walk_date', { ascending: false }).limit(500),
      supabase.from('walk_logs').select('*').order('created_at', { ascending: false }).limit(1000),
    ])

    const backup = {
      timestamp: now.toISOString(),
      type: isManual ? 'manual' : 'nightly',
      dogs: dogsRes.data || [],
      acuity_name_map: nameMapRes.data || [],
      walk_groups: walkGroupsRes.data || [],
      walk_logs: walkLogsRes.data || [],
    }

    const dogCount = backup.dogs.length

    // Ensure bucket exists (idempotent)
    await supabase.storage.createBucket('backups', { public: false }).catch(() => {})

    // Upload backup
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, JSON.stringify(backup, null, 2), {
        contentType: 'application/json',
        upsert: true,
      })

    if (uploadError) throw uploadError

    // Log the backup
    await supabase.from('backups_log').insert({
      file_path: `backups/${fileName}`,
      dog_count: dogCount,
      status: 'success',
      details: `Backed up ${dogCount} dogs, ${backup.acuity_name_map.length} name maps, ${backup.walk_groups.length} walk groups, ${backup.walk_logs.length} walk logs`,
    })

    // Clean up backups older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)

    const { data: oldFiles } = await supabase.storage.from('backups').list('', { limit: 500 })
    if (oldFiles) {
      const toDelete = oldFiles
        .filter(f => f.name < `dogs_backup_${thirtyDaysAgo}`)
        .map(f => f.name)

      if (toDelete.length > 0) {
        await supabase.storage.from('backups').remove(toDelete)
      }
    }

    return res.status(200).json({
      status: 'success',
      file: fileName,
      dogCount,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    // Log failure
    await supabase.from('backups_log').insert({
      file_path: `backups/${fileName}`,
      dog_count: 0,
      status: 'failed',
      details: err.message,
    }).catch(() => {})

    return res.status(500).json({ error: 'Backup failed', message: err.message })
  }
}
