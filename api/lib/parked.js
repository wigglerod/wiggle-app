/**
 * The parked-handler response shape — one place that answers "what is switched off,
 * behind which flag, and why".
 *
 * This is NOT a gate abstraction. The gate itself stays visible at each call site:
 *
 *   const live = process.env.GMAIL_INGEST_LIVE === 'true'
 *   if (!live) return res.status(200).json(parkedBody({ ... }))
 *
 * That is deliberate. Every other flag in this repo reads process.env.<THING>_LIVE
 * inline (api/group-engine.js:181, and the ACUITY_RECONCILE / BOARD_RECONCILE /
 * EXPLORER_AUTOCREATE flags), and hiding a kill switch behind a helper would make the
 * control flow of a safety gate invisible in the file it protects. Only the BODY is
 * shared, so the answers stay consistent and greppable.
 *
 * Why 200 and not a 5xx — the rule this repo now runs on. `isFatalApiError` (#236,
 * merged 2026-08-01 at 1298470) exists to make a non-2xx from these handlers MEAN
 * something is broken. A parked handler did exactly what it was told, so it is not a
 * fault, and a cron that goes red ~153 times a day by design is a smoke alarm nobody
 * hears when it matters. But never a bare {ok:true} either — that silence is what let
 * the classifier run dark from 2026-07-14 to 2026-07-31. ok:false + parked:true says
 * "this ran, it did not do its job, on purpose, and here is the switch."
 *
 * Off, never gone: nothing parked is deleted, and no schedule is removed from
 * vercel.json — a scheduled run that answers "parked" is visible in the logs, while a
 * deleted schedule is invisible.
 *
 * Shape first established by api/cron/draft-sweep.js (G1, efa666e). That handler
 * predates this module and already emits exactly this body, so it is left untouched.
 */

/**
 * @param {object}  o
 * @param {string}  o.handler  the handler's own name, for the log line
 * @param {string}  o.flag     the env var that turns it back on, e.g. 'GMAIL_INGEST_LIVE'
 * @param {string}  o.reason   why it is parked, in plain words a human can act on
 * @param {object} [o.extra]   handler-specific fields (counters kept at zero, etc.)
 */
export function parkedBody({ handler, flag, reason, extra = {} }) {
  return {
    ok: false,
    parked: true,
    handler,
    flag,
    flag_set: process.env[flag] != null,
    reason,
    to_resume: `set ${flag}=true on the wiggle-world Vercel project. Nothing was deleted; the schedule still runs.`,
    ...extra,
  }
}

/**
 * Log the gate's state. Names and booleans only, never a value — these flags are
 * Sensitive Vercel vars, and both halves of a gate are invisible from outside.
 * Same diagnostic register as api/group-engine.js:185.
 */
export function logGate(handler, flag) {
  const live = process.env[flag] === 'true'
  console.log(`[${handler}] gate`, { flag, flagSet: process.env[flag] != null, flagIsTrue: live })
  return live
}
