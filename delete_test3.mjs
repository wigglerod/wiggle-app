import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ifhniwjdrsswgemmqddn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmaG5pd2pkcnNzd2dlbW1xZGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTY1OTEsImV4cCI6MjA4Nzc5MjU5MX0.uMcr2oM77jJ26sVUXrQ8eGW7ZUwiniAAv3hgMv00Lxs'
)

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@wiggledogwalks.com',
    password: 'WiggleTest2026!'
  })
  if (authErr) { console.error('Auth error', authErr); return }
  
  const { data, error } = await supabase.from('walker_notes').select('*').eq('dog_name', 'Shaft').eq('walk_date', '2026-04-02')
  console.log('Existing notes for Shaft today:', data)
  
  if (data && data.length > 0) {
    const row = data[0]
    console.log('Trying to delete row with dog_name:', row.dog_name, 'walk_date:', row.walk_date, 'walker_id:', row.walker_id, 'mine:', auth.user.id)
    const { data: delData, error: delErr } = await supabase.from('walker_notes').delete()
      .eq('id', row.id)
      .select()
    console.log('Delete result by id:', delData, delErr)
  }
}
run()
