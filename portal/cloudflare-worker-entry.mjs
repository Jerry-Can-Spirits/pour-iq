// Cloudflare Workers entry point — wraps the OpenNext worker and adds the
// scheduled handler for Pour IQ's hourly jobs. .open-next/worker.js is
// generated at build time by opennextjs-cloudflare.
export * from './.open-next/worker.js'
import openNextWorker from './.open-next/worker.js'
import { runHourlyPosBackfill } from './src/lib/pouriq/pos/scheduled.ts'
import { runAccountingPushSweep } from './src/lib/pouriq/accounting/push.ts'

const worker = {
  async fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx)
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runHourlyPosBackfill(env))
    ctx.waitUntil(runAccountingPushSweep(env))
  },
}

export default worker
