import { useEffect } from 'react'
import { supabase } from './supabase'
import { resubscribeAllShared } from './sharedRealtimeChannel'

// OQ #56 / HIGH-2: iOS Safari and installed PWAs aggressively suspend
// WebSockets on backgrounded tabs. The Supabase channel object's local state
// stays "joined" but the socket is dead — events stop arriving and nothing
// reconnects. On visibility return we rebuild any channel not in a healthy
// state and re-propagate the access token so the new socket auths cleanly.
//
// Mount once at the app top level (above route remounts). Pairs with HIGH-1
// (setAuth on TOKEN_REFRESHED) and HIGH-3 (status callbacks).
export function useChannelHealth() {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'visible') return

      // Force a token freshness check first — visibility return is exactly the
      // moment iOS may have suspended us long enough to leave us with stale
      // tokens. Push the latest into the realtime layer before reconnecting.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          try {
            supabase.realtime.setAuth(session.access_token)
          } catch (e) {
            console.warn('[realtime] setAuth on visibility failed', e)
          }
        }
      })

      // Rebuild every shared channel — handlers are owned by hook mounts that
      // won't re-add themselves on visibility return, so removeChannel alone
      // would silently drop subscriptions. resubscribeAllShared swaps the
      // channel underneath while preserving the handler set.
      resubscribeAllShared()

      // For non-shared channels (currently only walk-groups-* via useWalkGroups
      // direct subscription), re-issue subscribe() in place on any channel
      // that has fallen out of joined/joining. The hook's useEffect deps don't
      // change on visibility return, so removeChannel here would orphan it.
      const channels = supabase.getChannels()
      for (const ch of channels) {
        const state = ch.state
        if (state === 'joined' || state === 'joining') continue
        if (ch.topic && ch.topic.startsWith('realtime:walk-groups-')) {
          try {
            ch.subscribe((status, err) => {
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                console.warn('[realtime] walk-groups (rejoin)', ch.topic, status, err)
              }
            })
          } catch (e) {
            console.warn('[realtime] resubscribe failed', ch.topic, e)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
}
