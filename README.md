# Pour IQ — marketing site

The public marketing and SEO site for [Pour IQ](https://pour-iq.co.uk), the menu and cost engineering platform for independent UK bars, built by Jerry Can Spirits Ltd.

## Phase 1 / Phase 2

**Phase 1 (this codebase today): marketing only.** Static or server-rendered pages, no authentication, no app code. The Pour IQ app currently lives inside the Jerry Can Spirits site behind a licence wall.

**Phase 2 (done 2026-07-12): the app lives in `portal/`.** The authenticated Pour IQ app — ported from the Jerry Can Spirits repo — is a standalone Next.js project at `portal/`, deployed as its own Cloudflare Worker at **app.pour-iq.co.uk** with its own D1 database (`pour-iq-db`), KV namespace, and R2 bucket, all Pour IQ-owned (WEUR region) and separate from JCS infrastructure. It has its own `package.json`, toolchain, and `wrangler.jsonc`; the root project's lint/typecheck/prettier deliberately exclude it. Work inside `portal/` with `cd portal && pnpm <script>`. The structure below keeps marketing and app concerns separated:

- `app/(marketing)/` — everything public. New marketing pages go here, never in `app/` root.
- `components/marketing/` — components only marketing pages use.
- `components/shared/` — components both worlds will share (buttons, typography). If in doubt, start in `marketing` and promote later.
- `lib/` — non-UI code. App business logic will arrive as its own modules here in phase 2.

## Structure

```
app/
  (marketing)/        home, pricing, about, case-studies, faq, privacy, terms, contact
  layout.tsx          root layout: landmarks, metadata, pre-launch noindex
  robots.ts           pre-launch: disallow all crawling
  globals.css         Tailwind v4 entry point + (later) the @theme token bridge
components/
  marketing/          marketing-only components
  shared/             components shared with the future app
lib/
  design-tokens.ts    typed token slots (colours, type scale, spacing, radii)
```

Placeholder pages are deliberately unstyled semantic HTML — the design pass is a separate task.

## Design tokens and Tailwind v4

Tailwind v4 is configured **in CSS**, not `tailwind.config.js`. The plan:

1. `lib/design-tokens.ts` holds the typed token object (currently empty slots — values arrive with the design pass; do not invent them).
2. A later task bridges those tokens into CSS custom properties inside an `@theme` block in `app/globals.css`, which makes them available as Tailwind utilities.
3. Components consume tokens only via Tailwind utilities — no hand-written colour or spacing values.

Mobile-first throughout: base styles target 390px-class viewports; widen with `sm:`/`md:`/`lg:` only.

## Security headers and CSP status

The CSP is nonce-based, built per request in `middleware.ts`: `script-src 'self' 'nonce-{value}' 'strict-dynamic'`, with no `'unsafe-inline'` in `script-src`. Next stamps the nonce onto every script it renders; the root layout reads the nonce via `headers()`, which is what opts every page into dynamic rendering. That cost was measured before shipping (2026-07-13, Workers preview edge): median homepage TTFB ~101ms dynamic versus ~103ms static, response size +2.3% — negligible on this stack, so the nonce policy shipped.

**`style-src` retains `'unsafe-inline'` — a documented, accepted exception:** the design-token system inlines CSS custom properties on `<html>` (`lib/design-tokens.ts` via the root layout), which needs inline style permission. Do not remove it without reworking token delivery.

Every other security header is set in `next.config.ts`: HSTS (browsers only enforce it over HTTPS in production; its presence locally is expected), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, and a `Permissions-Policy` denying every powerful feature the marketing site does not use. The Permissions-Policy governs this origin only: the app at app.pour-iq.co.uk sets its own headers (it uses the camera for barcode scanning). `poweredByHeader: false` removes `x-powered-by`.

**HSTS preload is deliberate:** the header carries the `preload` token, and the site may be submitted to hstspreload.org at launch — a planned future step, not an accident. Preload is effectively irreversible across the zone (`includeSubDomains`), so submit only once every subdomain is permanently HTTPS.

(`'unsafe-eval'` appears in development only — HMR needs it. Production policies never include it.)

After any CSP change: verify every page loads with zero console violations at mobile and desktop widths before merging.

## Pre-launch indexing protection

Three layers keep the site out of search results until launch (robots.txt alone only controls crawling, not indexing):

1. `robots: { index: false, follow: false }` in the root metadata (`app/layout.tsx`) — renders a `noindex` meta tag on every page.
2. `X-Robots-Tag: noindex, nofollow` response header (`next.config.ts`).
3. `app/robots.ts` — robots.txt disallowing all crawling.

### Launch day — remove in this order

1. `app/layout.tsx`: delete the `robots: { index: false, follow: false }` line (and its PRE-LAUNCH comment).
2. `next.config.ts`: delete the `X-Robots-Tag` header entry (and its PRE-LAUNCH comment).
3. `app/robots.ts`: switch the rule from `disallow: '/'` to `allow: '/'`. The `sitemap` reference is already in place (`app/sitemap.ts` lists all eight routes), so no other change is needed.
4. Deploy, then verify: `curl -sI https://pour-iq.co.uk` shows **no** `X-Robots-Tag`, page source has **no** `noindex` meta, `/robots.txt` allows crawling and references the sitemap, and `/sitemap.xml` serves all eight routes.

(`SITE_URL` no longer needs setting at launch: production builds default to `https://pour-iq.co.uk` in code — see Environment.)

## Brand assets

The identity is the logotype: the "Pour IQ" wordmark with the pour integrated, exactly as the site hero draws it. Where space allows, use the full lockup; where it does not (favicons, app icons, avatars), the IQ-and-underline tile. Nothing else exists — there is no standalone abstract mark, and the vertical pour stroke appears only alongside the word "Pour" (standalone it reads as the letter L).

Vector sources are the single source of truth; every raster asset is derived from a committed SVG, never the reverse. Colours are token values traced to `lib/design-tokens.ts` in each file's comments.

| File                                                                                                                 | Context                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/brand/pour-iq-lockup.svg`                                                                                    | The logotype: "Pour IQ" outlined from Bricolage Grotesque 800 (no font dependency) with the measure underline and vertical pour stroke. Generated; do not edit by hand.                        |
| `public/brand/iq-tile.svg`                                                                                           | "IQ" over the measure underline on the cellar tile (radius-md), true letterforms — use at 32px and above. Generated; do not edit by hand.                                                      |
| `public/brand/iq-tile-16.svg`                                                                                        | Hand-tuned simplified drawing for the 16px favicon slice only: plain I stem, Q ring with a bold straight tail (never dropped), thicker strokes.                                                |
| `public/icon.svg`, `public/favicon.ico`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png` | Favicon and app-icon derivatives of the tile, wired through the metadata icons API in `app/layout.tsx` and `public/site.webmanifest`. `icon-512.png` doubles as the Organization JSON-LD logo. |
| `public/og.png`                                                                                                      | The 1200×630 social card: the logotype optically centred, tagline beneath.                                                                                                                     |

Regenerate with:

```
pnpm brand:generate                        # lockup, tile, favicons, app icons
pwsh scripts/generate-og-image.ps1         # og.png (Windows; System.Drawing)
```

## Environment

Copy `.env.example` to `.env.local`. `SITE_URL` feeds `metadataBase` (canonical URLs, OG URLs); `KLAVIYO_API_KEY` is reserved for the newsletter/contact integration. No secrets are committed anywhere in this repo.

`SITE_URL` is optional: production builds (`pnpm build` / `pnpm deploy`) default to `https://pour-iq.co.uk` and dev defaults to `http://localhost:3000` (`lib/metadata.ts`). Set it only to override — e.g. a staging preview under its own domain. Note Next's env precedence: a `SITE_URL` in `.env.local` overrides everything, including production builds, so keep it out of `.env.local` unless that's what you mean.

## Commands

```
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm format       # Prettier write
```

Node is pinned via `.nvmrc` and the CI workflow uses the same file, so local and CI builds always run the same version. CI (GitHub Actions) runs lint, typecheck, and build on every push and pull request.
