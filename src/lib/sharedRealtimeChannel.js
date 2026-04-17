import { supabase } from './supabase'

// Shares one Supabase realtime channel across every caller that asks for the
// same channel name. The channel is created on the first subscriber and torn
// down when the last one unsubscribes — so mounting the same hook in multiple
// components produces one underlying subscription, not N.
//
// Same-name callers must use the same postgres_changes config (name is derived
// from the config, so this holds in practice).

const registry = new Map()

export function subscribeShared({ name, config }, handler) {
  let entry = registry.get(name)

  if (!entry) {
    entry = { channel: null, handlers: new Set() }
    registry.set(name, entry)
    entry.channel = supabase
      .channel(name)
      .on('postgres_changes', config, (payload) => {
        const e = registry.get(name)
        if (!e) return
        for (const h of e.handlers) h(payload)
      })
      .subscribe()
  }

  entry.handlers.add(handler)

  return () => {
    const e = registry.get(name)
    if (!e) return
    e.handlers.delete(handler)
    if (e.handlers.size === 0) {
      supabase.removeChannel(e.channel)
      registry.delete(name)
    }
  }
}
