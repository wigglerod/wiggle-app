// freshBundle — writer-path version gate (OQ #27 Option D).
//
// Closes the "old bundle still executing while new SW activates" window
// (Apr 15 Amelie incident) by checking /version.json before every write.
// Stale bundle → toast + reload, no write. Fresh bundle → silent passthrough.
//
// FAIL-OPEN by design: if /version.json fetch or parse fails, we treat the
// bundle as fresh. Stale-bundle false negative is preferred over blocking
// legitimate writes when the gate itself is broken. The build-time
// assertion in vite.config.js (versionAssertPlugin, OQ #62) is the upstream
// gate. The console.warn below is observable telemetry for the rare case
// where a runtime drift gets past the build (CDN serves stale, future
// bypass, etc.) — see Decision #117.

import { useCallback, useRef, useState } from 'react'
import { showStaleBundleToast } from '../components/StaleBundleToast.jsx'

const VERSION_URL = '/version.json'
const RELOAD_DELAY_MS = 1000

let reloadScheduled = false
let gateInactiveWarned = false

function warnGateInactive(reason) {
  if (gateInactiveWarned) return
  gateInactiveWarned = true
  console.warn(
    '[wiggle-freshBundle] version gate inactive: ' + reason + '. ' +
    'This is a deploy-plumbing issue, not a walker problem. ' +
    'Writes will continue normally. See decision #117.'
  )
}

export class StaleBundleError extends Error {
  constructor(serverVersion, currentVersion) {
    super(`Stale bundle: server=${serverVersion} current=${currentVersion}`)
    this.name = 'StaleBundleError'
    this.serverVersion = serverVersion
    this.currentVersion = currentVersion
  }
}

export async function assertFreshBundle() {
  // eslint-disable-next-line no-undef -- __APP_VERSION__ is a Vite define
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null

  let serverVersion = null
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' })
    if (!res.ok) {
      warnGateInactive('/version.json HTTP ' + res.status)
      return { fresh: true, server_version: null, current_version: currentVersion }
    }
    const body = await res.json()
    if (!body || typeof body.version !== 'string') {
      warnGateInactive('/version.json missing or invalid `version` field')
      return { fresh: true, server_version: null, current_version: currentVersion }
    }
    serverVersion = body.version
  } catch (e) {
    warnGateInactive('/version.json returned non-JSON or fetch failed: ' + e.message)
    return { fresh: true, server_version: null, current_version: currentVersion }
  }

  if (!currentVersion) return { fresh: true, server_version: serverVersion, current_version: null }

  return {
    fresh: serverVersion === currentVersion,
    server_version: serverVersion,
    current_version: currentVersion,
  }
}

export async function assertFreshOrThrow() {
  const result = await assertFreshBundle()
  if (result.fresh) return
  if (!reloadScheduled) {
    reloadScheduled = true
    showStaleBundleToast()
    setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
  }
  throw new StaleBundleError(result.server_version, result.current_version)
}

export function useFreshBundle() {
  const [lastChecked, setLastChecked] = useState(null)
  const inflight = useRef(null)

  const check = useCallback(async () => {
    if (inflight.current) return inflight.current
    inflight.current = assertFreshBundle().then(r => {
      setLastChecked(Date.now())
      inflight.current = null
      return r.fresh
    })
    return inflight.current
  }, [])

  return { check, lastChecked }
}
