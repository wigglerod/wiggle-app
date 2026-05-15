import { useEffect } from 'react'
import { supabase } from './supabase'
import { resubscribeAllShared } from './sharedRealtimeChannel'
import { useRealtimeHealth } from '../context/RealtimeHealthContext'

// OQ #56 / HIGH-2 (channel rebuild) and audit 2026-05-13 HIGH #2/#3/#4
// (resync + multi-event + active probe).
//
// iOS Safari and installed PWAs aggressively suspend WebSockets on
// backgrounded tabs. The Supabase channel object's local state stays
// "joined" but the socket is dead — events stop arriving and nothing
// reconnects. We listen on every event browsers may fire when the user
// returns to the app (visibilitychange, pageshow with persisted, focus)
// plus an active 30s probe of supabase.getChannels() as a backstop for
// silent WebSocket death while the tab is foregrounded.
//
// On each trigger: refresh auth, rebuild every shared channel in place,
// rejoin any walk-groups-* channels that fell out of joined/joining, then
// bumpResync() so hook consumers (usePickups, useOwlNotes, useWalkGroups)
// re-run their load() and backfill any rows missed while the socket was
// dead. Channel rebuild without refetch is the audit HIGH #2 root.
//
// Mount once at the app top level (above route remounts). Pairs with
// HIGH-1 (setAuth on TOKEN_REFRESHED in AuthContext) and HIGH-3 (status
// callbacks in sharedRealtimeChannel + useWalkGroups).
export function useChannelHealth() {
  const { bumpResync } = useRealtimeHealth()

  useEffect(() => {
    async function handleResync() {
      // Force a token freshness check first — visibility return is exactly the
      // moment iOS may have suspended us long enough to leave us with stale
      // tokens. Push the latest into the realtime layer before reconnecting.
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token)
        }
      } catch (e) {
        console.warn('[realtime] setAuth on resync failed', e)
      }

      // Rebuild every shared channel — handlers are owned by hook mounts that
      // won't re-add themselves on resync, so removeChannel alone would
      // silently drop subscriptions. resubscribeAllShared swaps the channel
      // underneath while preserving the handler set.
      resubscribeAllShared()

      // For non-shared channels (currently only walk-groups-* via useWalkGroups
      // direct subscription), re-issue subscribe() in place on any channel
      // that has fallen out of joined/joining. The hook's useEffect deps don't
      // change on resync, so removeChannel here would orphan it.
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

      // Tell hook consumers to re-run their initial load() so any
      // postgres_changes events emitted while the socket was dead are
      // backfilled from the REST endpoint. Debounced inside the context.
      bumpResync()
    }

    function onVisibility() {
      if (document.visibilityState !== 'visible') return
      handleResync()
    }

    function onPageShow(event) {
      // bfcache restore can skip visibilitychange entirely on iOS Safari.
      if (event.persisted) handleResync()
    }

    function onFocus() {
      // Cross-tab return inside the same browser window can fire focus
      // without firing visibilitychange.
      handleResync()
    }

    function onOnline() {
      // Audit 2026-05-13 Finding #7: coverage-return path. useOffline replays
      // the write queue on 'online', but channels themselves stay dead until
      // the next visibility/focus event. Rebuild here so the basement →
      // upstairs recovery doesn't depend on the walker also switching tabs.
      handleResync()
    }

    function activeProbe() {
      if (document.visibilityState !== 'visible') return
      const channels = supabase.getChannels()
      for (const ch of channels) {
        const state = ch.state
        if (state !== 'joined' && state !== 'joining') {
          console.warn('[realtime] active probe found unhealthy channel', ch.topic, state)
          handleResync()
          return
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    const probeInterval = setInterval(activeProbe, 30000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
      clearInterval(probeInterval)
    }
  }, [bumpResync])
}
