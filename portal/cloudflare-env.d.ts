// Bindings and secrets for the Pour IQ portal worker. Mirrors
// portal/wrangler.jsonc (bindings) plus the secrets set via
// `wrangler secret put`. Only what the ported Pour IQ code actually
// uses — the JCS-only secrets stayed behind in the entity split.
interface CloudflareEnv {
  // Static assets (OpenNext)
  ASSETS: Fetcher;

  // KV
  SITE_OPS: KVNamespace;

  // D1
  DB: D1Database;

  // R2
  TRADE_DOCS: R2Bucket;

  // Secrets — Anthropic (invoice extraction, menu import, AI descriptions)
  ANTHROPIC_API_KEY: string;

  // Secrets — at-rest encryption for stored OAuth tokens (32 bytes, base64)
  TOKEN_ENCRYPTION_KEY: string;

  // Secrets — PIN hashing pepper (32 bytes, base64). Optional so the
  // credential code can ship dark: until the secret is set, login uses
  // the legacy plaintext path and the hash sweep no-ops.
  PIN_PEPPER?: string;

  // Secrets — POS integrations
  SQUARE_APP_ID: string;
  SQUARE_APP_SECRET: string;
  SQUARE_ENV: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY: string;
  ZETTLE_CLIENT_ID: string;
  ZETTLE_CLIENT_SECRET: string;
  SUMUP_CLIENT_ID: string;
  SUMUP_CLIENT_SECRET: string;

  // Secrets — accounting integrations
  XERO_CLIENT_ID: string;
  XERO_CLIENT_SECRET: string;
  QUICKBOOKS_CLIENT_ID: string;
  QUICKBOOKS_CLIENT_SECRET: string;
  QUICKBOOKS_ENV: string;
}
