import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@wiggledogwalks.com',
    password: 'WiggleTest2026!'
  })
  if (authErr) { console.error('Auth error', authErr); return }
  
  const { data, error } = await supabase.from('walker_notes').select('*').eq('note_type', 'pickup')
  console.log('Existing pickup notes:', data)
  
  if (data && data.length > 0) {
    console.log('Trying to delete row', data[0])
    const { data: delData, error: delErr } = await supabase.from('walker_notes').delete().eq('id', data[0].id).select()
    console.log('Delete result:', delData, delErr)
  }
}
run()
