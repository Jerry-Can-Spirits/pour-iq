// Cloudflare Workers entry point — wraps the OpenNext worker and adds the
// scheduled handler for Pour IQ's hourly jobs. .open-next/worker.js is
// generated at build time by opennextjs-cloudflare.
export * from './.open-next/worker.js'
import openNextWorker from './.open-next/worker.js'
import { runHourlyPosBackfill } from './src/lib/pouriq/pos/scheduled.ts'
import { runAccountingPushSweep } from './src/lib/pouriq/accounting/push.ts'
import { primeTokenKey } from './src/lib/pouriq/token-crypto.ts'
import { runRetentionSweep } from './src/lib/pouriq/retention.ts'
import { runTokenBackfill } from './src/lib/pouriq/token-backfill.ts'
import { runCredentialSweep } from './src/lib/scheduled-credentials.ts'

const worker = {
  async fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx)
  },

  async scheduled(event, env, ctx) {
    // No request context here, so the token crypto key must be primed
    // before any sweep touches an OAuth token.
    primeTokenKey(env)
    ctx.waitUntil(runHourlyPosBackfill(env))
    ctx.waitUntil(runAccountingPushSweep(env))
    // Credentials-at-rest sweeps: hash any plaintext PINs, encrypt any
    // token rows the write-path-only hardening left behind. Both are
    // idempotent and no-op once every row is converted.
    ctx.waitUntil(runCredentialSweep(env))
    ctx.waitUntil(runTokenBackfill(env))
    // Retention enforcement runs once a day, on the 04:00 UTC tick of the
    // hourly cron.
    if (new Date(event.scheduledTime).getUTCHours() === 4) {
      ctx.waitUntil(runRetentionSweep(env))
    }
  },
}

export default worker
