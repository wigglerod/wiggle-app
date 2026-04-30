import { supabase } from './supabase'

// Shares one Supabase realtime channel across every caller that asks for the
// same channel name. The channel is created on the first subscriber and torn
// down when the last one unsubscribes — so mounting the same hook in multiple
// components produces one underlying subscription, not N.
//
// Same-name callers must use the same postgres_changes config (name is derived
// from the config, so this holds in practice).

const registry = new Map()

function buildChannel(name, config) {
  return supabase
    .channel(name)
    .on('postgres_changes', config, (payload) => {
      const e = registry.get(name)
      if (!e) return
      for (const h of e.handlers) h(payload)
    })
    .subscribe((status, err) => {
      // OQ #56 / HIGH-3: surface JOIN failures that supabase-js otherwise swallows.
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[realtime] shared channel', name, status, err)
      }
    })
}

export function subscribeShared({ name, config }, handler) {
  let entry = registry.get(name)

  if (!entry) {
    entry = { channel: null, config, handlers: new Set() }
    registry.set(name, entry)
    entry.channel = buildChannel(name, config)
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

// OQ #56 / HIGH-2: rebuild every shared channel in place, preserving handler
// sets. Called from useChannelHealth on visibility return. removeChannel alone
// would orphan the registry entry — handlers are owned by long-lived hook
// mounts that won't re-add themselves on visibility change.
export function resubscribeAllShared() {
  for (const [name, entry] of registry.entries()) {
    if (entry.channel) {
      try { supabase.removeChannel(entry.channel) } catch { /* noop */ }
    }
    entry.channel = buildChannel(name, entry.config)
  }
}
