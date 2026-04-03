// useActivityNotes.js
// Writes after-walk notes to walker_notes table.
// Also optionally creates an owl_notes row (warn next walker).

import { supabase } from '../lib/supabase'

export function useActivityNotes() {

  const writeNote = async ({
    dogId,
    dogName,
    dogSector,
    walkerId,
    walkerName,
    message,        // free text — may be empty if chips only
    chips,          // array of selected chip labels e.g. ['Reactive', 'Great walk 🐾']
    warnNextWalker, // boolean — if true, also write to owl_notes
    flag,           // boolean — if true, add 'flag' to tags
  }) => {

    // Build the tags array from chips + flag
    const tags = [...(chips || [])]
    if (flag) tags.push('flag')

    // Build the full message — chips first, then free text
    const fullMessage = [
      chips?.length ? chips.join(', ') : null,
      message?.trim() || null
    ].filter(Boolean).join(' — ') || null

    // 1. Write activity note to walker_notes
    const { error: noteError } = await supabase
      .from('walker_notes')
      .insert({
        dog_id: dogId,
        dog_name: dogName,
        walker_id: walkerId,
        walker_name: walkerName,
        note_type: 'note',
        message: fullMessage,
        tags: tags.length ? tags : null,
        walk_date: new Date().toISOString().split('T')[0],
      })

    if (noteError) throw noteError

    // 2. If warn next walker — also write to owl_notes
    if (warnNextWalker && fullMessage) {
      const { error: owlError } = await supabase
        .from('owl_notes')
        .insert({
          note_text: fullMessage,
          target_type: 'dog',
          target_dog_id: dogId,
          target_dog_name: dogName,
          target_sector: dogSector,
          created_by: walkerId,
          created_by_name: walkerName,
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          note_date: new Date().toISOString().split('T')[0],
        })

      if (owlError) throw owlError
    }

    return { success: true }
  }

  return { writeNote }
}
