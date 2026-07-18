# Security baseline

The security standard shared by the Jerry Can Spirits Ltd repos (`pour-iq` and `jerry-can-spirits`). The baseline section is near-identical in both repos; the sections after it state where **this repo** stands against it, with file references, and end with the known gaps. Docs only — each gap ships as its own PR.

This repo is two surfaces: the **marketing site** at the root (Worker `pour-iq`, pour-iq.co.uk) and the **portal** in `portal/` (Worker `pour-iq-portal`, app.pour-iq.co.uk, with its own D1/KV/R2). They are assessed separately below.

Audited: 2026-07-13.

---

## The baseline (applies to all new work)

1. **HTTP headers.** Every response carries HSTS (with preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a Permissions-Policy denying what the app does not use, and a CSP. Framing is denied by default (`frame-ancestors 'none'` and/or `X-Frame-Options: DENY`) with narrow, documented per-route exceptions.
2. **CSP.** `default-src 'self'`; `object-src 'none'`; `base-uri 'self'`. Third-party hosts are allowlisted individually, never wildcarded. `'unsafe-eval'` in development only, never production. `'unsafe-inline'` only as a documented, dated acceptance.
3. **Secrets.** Real secrets live in Wrangler secrets (or CI secrets), never in source, never in `.env` files that could be committed. `.env*`, `.dev.vars`, and `.wrangler/` are gitignored. Public client identifiers may live in source but are commented as deliberately public.
4. **Auth and sessions.** Sessions are opaque random IDs in KV with a TTL, delivered as `httpOnly`, `secure`, `sameSite` cookies, and re-validated against the datastore on every request. Login endpoints are rate-limited per-IP and per-credential and check request origin. Credentials are stored hashed, never plaintext (currently unmet — see gaps).
5. **Third parties.** No third-party script loads without consent gating where consent law applies. Consent defaults to denied before any tag runs. Every third-party addition updates the CSP allowlist and the consent gating in the same PR.
6. **Disclosure.** A `.well-known/security.txt` with an unexpired `Expires`, pointing at a published security policy page with response SLAs and safe harbor. The contact address in both must match.
7. **Dependencies.** Dependabot on every package manifest in the repo (including sub-projects), grouped minor/patch updates, and CI that lints, typechecks, and builds every project the repo contains on every PR.
8. **Data.** Every datastore states what it holds, its region, and its retention. Tenant/business data has an export path and an automated retention sweep implementing the published privacy policy. Documents in R2 carry lifecycle rules.

---

## Where the marketing site stands (root)

### Headers and CSP
Hardened 2026-07-13. The CSP is nonce-based, built per request in `middleware.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`, no `'unsafe-inline'` in `script-src`; the dynamic-rendering cost was measured before shipping — see README). `style-src` retains `'unsafe-inline'` as a documented, accepted exception for the design-token system. All other headers in `next.config.ts`: HSTS preload, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, COOP `same-origin`, CORP `same-origin`, and a Permissions-Policy denying every powerful feature this origin does not use (the portal sets its own — it needs the camera). `X-Robots-Tag: noindex, nofollow` is a deliberate pre-launch state with a documented launch-day removal checklist.

### Third parties
None. The marketing site loads zero third-party scripts — no analytics, no consent banner needed yet. If one is ever added, baseline §5 applies from the first script: consent gating plus CSP allowlisting in the same PR.

### Secrets
No secrets in source. `.env.example` documents `SITE_URL` and `KLAVIYO_API_KEY`; the Klaviyo key is referenced nowhere in code (reserved for the future newsletter integration — do not treat it as wired).

---

## Where the portal stands (`portal/`)

### Headers and CSP
Shipped 2026-07-15, ported from the marketing site's reference implementation (the root `middleware.ts` and `next.config.ts`). The CSP is nonce-based, built per request in `portal/src/middleware.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`; the portal is fully dynamic already, so the nonce carries no rendering cost). Scoped from an audit of what the app actually loads: it connects only to its own routes and serves every asset itself, so no third-party allowances exist anywhere in the policy. `style-src` retains `'unsafe-inline'` for inline style attributes — the same documented exception class as the marketing site. `portal/next.config.ts` carries the rest: HSTS preload, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, COOP `same-origin`, CORP `same-origin`, no `x-powered-by`, and the marketing deny-list Permissions-Policy with one exception — **`camera=(self)`** for the barcode scanner (exercised under the policy with a fake camera device in the Workers preview; real-phone check flagged in the shipping PR). Every portal flow verified with zero CSP console violations on workerd.

### Auth and licensing
Sessions follow the baseline: `crypto.randomUUID()` sid in KV, 30-day TTL, `httpOnly`/`secure`/`lax` cookie (`portal/src/lib/trade-portal/session.ts`), re-validated per request. Login (`portal/src/app/api/login/route.ts`) layers four rate-limit controls, all checked before PIN verification and (except the coarse request cap) incremented on genuine failure only, so a valid PIN never counts against a venue: a per-IP request cap (60/hour), a venue-safe per-IP failure ceiling (20 / 15 min — bars share one NAT'd wifi IP), a per-credential counter (10 / hour, keyed by a PIN hash, never the raw PIN), and a **global failed-login velocity** counter (100 / 10 min across all IPs and PINs) — the primary bound on *distributed* enumeration of the PIN space, added 2026-07-18 to match the JCS reference (the per-IP and per-PIN counters are both defeated by spreading guesses). A same-host origin check (compared against the request's own Host, not a hardcoded domain — the hardcoded constant is what silently 403ed the portal after the domain move). On top of sessions, `checkPourIqAccess()` (`portal/src/lib/pouriq/access.ts`) verifies a currently-valid licence window (`no-session | no-licence | ok`).

PINs are stored hashed (`portal/src/lib/trade-portal/credentials.ts`, a byte-identical copy of the JCS reference implementation): HMAC-SHA-256 with the `PIN_PEPPER` Wrangler secret — so a database dump alone cannot be brute-forced, the defence that matters most for a low-entropy PIN — then PBKDF2-SHA-256 (100k iterations — the Workers WebCrypto maximum, discovered live; per-row iteration counts allow raising it if the cap ever lifts — constant-time compare), with a deterministic peppered HMAC in `pin_lookup` for the login SELECT. Format `pin:v1:` is versioned; `pw:v1:` is reserved for the planned owner username/password model. Migration is self-healing: the hourly cron sweep hashes plaintext rows and login upgrades stragglers on first contact; until `PIN_PEPPER` is set the code runs dark on the legacy path.

A **six-digit minimum PIN** is the deliberate long-term floor for the venue login, enforced at login (`pin.length < 6`); six, not higher, trades brute-force headroom against a shared bar tablet's usability, and the global velocity counter carries the enumeration defence. **Turnstile-after-N-failures** is a considered-and-deferred follow-up, not an oversight: the friction would land only on someone already failing repeatedly, so it is defence-in-depth rather than urgent.

### Data protection (the compliance hardening, 2026-07)
- **Token encryption** — `portal/src/lib/pouriq/token-crypto.ts`: AES-256-GCM via WebCrypto, key from the `TOKEN_ENCRYPTION_KEY` Wrangler secret, format `enc:v1:<iv>:<ct>`, legacy plaintext passthrough on read with re-encrypt-on-write. Covers POS and accounting OAuth tokens.
- **Export** — `GET /api/pouriq/export`: full tenant JSON (9 direct + 12 joined tables), licence-gated, deliberately excluding encrypted connection secrets and shared catalogues.
- **Retention** — `portal/src/lib/pouriq/retention.ts`, hourly cron: venue data deleted 2 years after licence lapse (scrubbed tombstone kept), invoices and R2 PDFs deleted 6 years after invoice date (HMRC), empty tombstones removed.
- **Residency** — D1/KV/R2 pinned to WEUR to match the privacy policy (`portal/wrangler.jsonc`).

The cross-venue guarantee is architectural, not just copy: no feature, screen, or report shows one venue's data to another venue or to us. Changes must preserve this — see the claims discipline in `docs/VOICE.md`.

### Secrets
All real secrets (Anthropic key, token encryption key, POS/accounting client secrets, Square webhook signature key) via Wrangler secrets, enumerated in `portal/cloudflare-env.d.ts`. No secrets in source.

### Dependencies and CI
Dependabot covers the **root manifest only** — `portal/package.json` is not watched. CI (`.github/workflows/ci.yml`) installs, lints, typechecks, and builds the **root only**; the portal is not built or linted in CI. Node pinned via `.nvmrc` (24.8.0); the portal has no pin of its own. `.dev.vars` is not in `.gitignore` (unused today, but should be listed).

---

## Reference implementations

Each shared control names the repo whose implementation is canonical, so fixes port rather than get reinvented and the repos cannot drift back apart. When a control ships its first implementation, name it here and in the JCS copy of this file in the same PR.

- **Token encryption at rest** — reference: this repo's portal (`portal/src/lib/pouriq/token-crypto.ts`). JCS ports it.
- **Credential (PIN) hashing** — reference: JCS (`src/lib/trade-portal/credentials.ts`, peppered HMAC + PBKDF2 with `pin_lookup` login column). This repo's portal carries a byte-identical copy.
- **Trade-portal login rate limiting / PIN brute-force hardening** — reference: JCS (`src/lib/kv.ts` counters + the login-route flow: per-IP request cap, venue-safe failures-only per-IP ceiling, per-credential counter, and the global failed-login velocity bound). This repo's portal carries the byte-identical reconciled version. Reconciled 2026-07-18 — the whole auth surface now has one owner (JCS), so hashing and brute-force cannot drift apart again.
- **Consent gating of third parties** — reference: JCS (Cookiebot + Consent Mode v2, per-component gating).
- **Vulnerability disclosure** — reference: JCS (`security.txt` + `/security-policy`).
- **Data retention, export, and residency** — reference: this repo's portal (`retention.ts`, the export endpoint, WEUR pinning).

---

## Gaps (in rough priority order — sequenced against the pre-August board)

1. ~~**Hash trade PINs**~~ — shipped 2026-07-13 (see Auth above), sequenced before The Bank's real account exists. Requires the `PIN_PEPPER` secret set on the portal Worker and migration 0070 applied; until then the code runs dark on the legacy plaintext path.
2. ~~**Portal CSP**~~ — shipped 2026-07-15 (see Headers above): nonce CSP via middleware, Permissions-Policy with `camera=(self)`, COOP/CORP, ported from the marketing reference.
3. ~~**CI and Dependabot for the portal**~~ — shipped 2026-07-15: the CI workflow runs lint, typecheck, the workerd credential suite, and build for `portal/` alongside the root; Dependabot watches both package trees weekly. Portal ESLint itself was silently broken (no config of its own, cross-tree resolution died in the rushstack patch) and now genuinely runs.
4. ~~**Token-encryption backfill**~~ — shipped 2026-07-13: `token-backfill.ts` runs from the hourly cron and encrypts any plaintext token rows the write-path-only hardening left behind (idempotent; no-ops once every row carries `enc:v1:`). Verify after the first run: `SELECT COUNT(*) ... WHERE access_token NOT LIKE 'enc:v1:%'` across both connections tables → 0.
5. **Vulnerability disclosure** — no `security.txt` and no security policy page on either surface. Add `.well-known/security.txt` and a policy page (the JCS `/security-policy` is the model). Canonical contact address: `security@jerrycanspirits.co.uk`.
6. ~~**Launch-day CSP decision**~~ — resolved 2026-07-13 in the marketing hardening (#30): nonce CSP shipped with the measured dynamic-rendering cost; `style-src 'unsafe-inline'` documented as the token-system exception.
7. **Housekeeping** — ~~add `.dev.vars` to `.gitignore`~~ (done 2026-07-15); remove or clearly mark the unused `KLAVIYO_API_KEY` in `.env.example` (superseded — the key is now genuinely used by the contact form).

Resolved 2026-07-18 (trade-portal auth hardening, reconciled with JCS — JCS is now the reference for the whole auth surface, above): added the global failed-login velocity counter that closes the **distributed-enumeration gap** (audit L3) the per-IP and per-PIN counters both miss — an attacker spreading guesses across IPs and PIN values hit a fresh key on every guess and tripped neither. The venue-safe failures-only per-IP ceiling and the per-credential counter (M2) were already in place; the reconciled version is byte-identical to JCS, and the per-credential counter's misleading "account-level" comment is corrected. The six-digit PIN floor is already enforced here; JCS is bringing its floor up to match, staged behind a one-off account reissue.

## Standing verification notes

Warnings recorded here rather than in PR descriptions, where they go to be forgotten:

- **Region pinning vs privacy policy wording** — D1/KV/R2 are WEUR-pinned; confirm the privacy policy's data-location wording matches what WEUR actually guarantees, and revisit if Cloudflare's residency semantics change.
- **Retention-sweep dry run, 2028** — the first venue-data deletions under the 2-year rule cannot occur before 2028. Before the first real deletion window opens, dry-run `retention.ts` against production data and verify the tombstone and HMRC-invoice behaviour match the privacy policy.
- **Local workerd does not enforce production limits** — verified 2026-07-15: the vitest-pool-workers simulator happily runs PBKDF2 at 600k iterations while production Workers rejects anything above 100k. The credential suite runs on workerd in CI for real WebCrypto behaviour, but the iteration cap is guarded by an explicit pinned assertion, and any future change to production-limit-sensitive crypto must be verified against deployed Workers, not the simulator.
