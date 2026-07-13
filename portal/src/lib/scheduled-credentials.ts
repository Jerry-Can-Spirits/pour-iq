// Hourly cron sweep: replace any plaintext trade-account PINs with the
// peppered hash + lookup pair from lib/trade-portal/credentials. Runs
// dark until the PIN_PEPPER secret is set; idempotent afterwards (the
// WHERE clause matches nothing once every row is hashed). The login
// route upgrades rows on first contact too — this sweep guarantees the
// stragglers are gone within the hour.

import { hashPin, pinLookupKey } from './trade-portal/credentials'

interface CredentialsEnv {
  DB: D1Database
  PIN_PEPPER?: string
}

export async function runCredentialSweep(env: CredentialsEnv): Promise<void> {
  if (!env.PIN_PEPPER) return

  const { results } = await env.DB.prepare(
    `SELECT id, pin FROM trade_accounts WHERE pin NOT LIKE 'pin:v1:%' AND pin NOT LIKE 'purged-%'`,
  ).all<{ id: string; pin: string }>()

  for (const row of results) {
    // The pin = ?4 guard skips rows a concurrent login already upgraded.
    await env.DB.prepare(
      `UPDATE trade_accounts SET pin = ?1, pin_lookup = ?2 WHERE id = ?3 AND pin = ?4`,
    )
      .bind(
        await hashPin(env.PIN_PEPPER, row.pin),
        await pinLookupKey(env.PIN_PEPPER, row.pin),
        row.id,
        row.pin,
      )
      .run()
  }
}
