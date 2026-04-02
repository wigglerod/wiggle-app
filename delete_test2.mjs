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
  
  const { data, error } = await supabase.from('walker_notes').select('*').eq('note_type', 'pickup')
  console.log('Existing pickup notes count:', data?.length)
  
  if (data && data.length > 0) {
    const row = data[0]
    console.log('Trying to delete row with dog_name:', row.dog_name, 'walk_date:', row.walk_date)
    const { data: delData, error: delErr } = await supabase.from('walker_notes').delete()
      .eq('dog_name', row.dog_name)
      .eq('note_type', 'pickup')
      .eq('walk_date', row.walk_date)
      .select()
    console.log('Delete result:', delData, delErr)
  }
}
run()
