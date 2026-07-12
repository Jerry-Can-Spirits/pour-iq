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
Set in `next.config.ts`: HSTS preload, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, and an interim CSP — everything `'self'` except `script-src`/`style-src`, which accept `'unsafe-inline'` because Next.js hydration requires inline scripts (`'unsafe-eval'` dev-only). The interim status and the launch decision (nonce-based CSP via middleware vs a dated acceptance) are documented in the README. No Permissions-Policy or COOP yet. `X-Robots-Tag: noindex, nofollow` is a deliberate pre-launch state with a documented launch-day removal checklist.

### Third parties
None. The marketing site loads zero third-party scripts — no analytics, no consent banner needed yet. If one is ever added, baseline §5 applies from the first script: consent gating plus CSP allowlisting in the same PR.

### Secrets
No secrets in source. `.env.example` documents `SITE_URL` and `KLAVIYO_API_KEY`; the Klaviyo key is referenced nowhere in code (reserved for the future newsletter integration — do not treat it as wired).

---

## Where the portal stands (`portal/`)

### Headers and CSP
`portal/next.config.ts` sets only `X-Frame-Options: DENY`, nosniff, Referrer-Policy, and HSTS. **No CSP, no Permissions-Policy, no COOP** — the weakest headers of any surface in either repo, on the surface handling the most sensitive data. Top follow-up.

### Auth and licensing
Sessions follow the baseline: `crypto.randomUUID()` sid in KV, 30-day TTL, `httpOnly`/`secure`/`lax` cookie (`portal/src/lib/trade-portal/session.ts`), re-validated per request. Login (`portal/src/app/api/login/route.ts`) is rate-limited per-IP and per-PIN with an origin allowlist check. On top of sessions, `checkPourIqAccess()` (`portal/src/lib/pouriq/access.ts`) verifies a currently-valid licence window (`no-session | no-licence | ok`). **PINs are stored and compared in plaintext** in `trade_accounts.pin` — the standing violation of baseline §4, shared with the JCS trade portal (same ported code).

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
- **Credential (PIN) hashing** — no reference yet; unimplemented in both repos. Whichever repo ships first becomes the reference.
- **Consent gating of third parties** — reference: JCS (Cookiebot + Consent Mode v2, per-component gating).
- **Vulnerability disclosure** — reference: JCS (`security.txt` + `/security-policy`).
- **Data retention, export, and residency** — reference: this repo's portal (`retention.ts`, the export endpoint, WEUR pinning).

---

## Gaps (in rough priority order — sequenced against the pre-August board)

1. **Hash trade PINs** (shared with JCS — same ported code). In the portal the PIN *is* the login: one plaintext PIN per venue in D1. Hash (Argon2/bcrypt-class — hashing, not encryption, since a PIN only ever needs verifying), constant-time compare, migrate existing rows — **before The Bank's real account is created**, so the pilot never has a plaintext-credential era.
2. **Portal CSP** — add a CSP (plus Permissions-Policy and COOP) to `portal/next.config.ts`. The portal is an app, not a prerendered site, so the marketing site's nonce-versus-static dilemma does not apply; the policy can be strict. Permissions-Policy allows camera (self only) for barcode scanning.
3. **CI and Dependabot for the portal** — add `portal/` as a Dependabot directory and a CI job that typechecks and builds the portal; add Dependabot reviewers. Until then, the app code that ships to venues is the code with no automated checks.
4. **Token-encryption backfill** — the compliance PR encrypts on write only (`decryptToken` passes legacy plaintext through, and no backfill migration exists), so plaintext rows can survive until a connection's next token refresh. Run a one-off backfill, or verify none remain: `SELECT COUNT(*) ... WHERE access_token NOT LIKE 'enc:v1:%'` across both connections tables. The JCS port needs the same backfill from day one.
5. **Vulnerability disclosure** — no `security.txt` and no security policy page on either surface. Add `.well-known/security.txt` and a policy page (the JCS `/security-policy` is the model). Canonical contact address: `security@jerrycanspirits.co.uk`.
6. **Launch-day CSP decision** (existing README TODO) — nonce-based CSP via middleware or a dated acceptance of `'unsafe-inline'`; plus Permissions-Policy/COOP on the marketing site.
7. **Housekeeping** — add `.dev.vars` to `.gitignore`; remove or clearly mark the unused `KLAVIYO_API_KEY` in `.env.example`.

## Standing verification notes

Warnings recorded here rather than in PR descriptions, where they go to be forgotten:

- **Region pinning vs privacy policy wording** — D1/KV/R2 are WEUR-pinned; confirm the privacy policy's data-location wording matches what WEUR actually guarantees, and revisit if Cloudflare's residency semantics change.
- **Retention-sweep dry run, 2028** — the first venue-data deletions under the 2-year rule cannot occur before 2028. Before the first real deletion window opens, dry-run `retention.ts` against production data and verify the tombstone and HMRC-invoice behaviour match the privacy policy.
