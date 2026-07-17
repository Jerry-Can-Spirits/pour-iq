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

The CSP is nonce-based, built per request in `middleware.ts`: `script-src 'self' 'nonce-{value}' 'strict-dynamic'`, with no `'unsafe-inline'` in `script-src`. Next stamps the nonce onto every script it renders; the root layout reads the nonce via `headers()`, which is what opts every page into dynamic rendering. That cost was measured before shipping (2026-07-13, Workers preview edge): median homepage TTFB ~101ms dynamic versus ~103ms static, response size +2.3% — negligible on this stack, so the nonce policy shipped. A hash-based CSP that would reclaim static generation was re-evaluated in the CWV audit (2026-07-17) and again declined: the ~2ms TTFB saving does not justify losing the single nonce-CSP pattern shared with the portal or taking on per-build script-hash maintenance (a drifted hash breaks the site silently). Revisit only if post-launch traffic shows marketing TTFB affecting conversions.

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

Also at launch: add the `offers` node to the home `SoftwareApplication` JSON-LD (`app/(marketing)/page.tsx`), taking the figure from `lib/pricing.ts` — never a hand-typed price. The node is omitted pre-launch because the price is not yet public; wire it only once the founding-rate cost-check is settled.

(`SITE_URL` no longer needs setting at launch: production builds default to `https://pour-iq.co.uk` in code — see Environment.)

### Launch — on-device eyeball

Once deployed, on a real mid-range Android over throttled wifi (these are per-launch eyeball checks, not automated):

- **Hero, no font-swap shift (CLS):** `next/font`'s size-adjusted fallback should neutralise the display-font swap; only tune the fallback stack if a shift is actually visible (tuning to fix a shift that isn't there just introduces a different one).
- **Reduced motion:** with `prefers-reduced-motion: reduce`, the pour animation is suppressed and the hero shows its finished composition.
- **320px:** no horizontal scroll on any page at the narrowest supported width.

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

## Contact form (demo booking)

`/contact` carries the site's only form and its only third-party integration. Submissions run through a server action on the Workers runtime (`app/(marketing)/contact/actions.ts`): every field is validated server-side independent of client checks, nothing is stored or forwarded without the consent box checked, and the submission is forwarded server-side to Klaviyo (`lib/klaviyo.ts`) — profile create-or-update plus the demo-requests list, consent recorded with a timestamp. `KLAVIYO_API_KEY` and `KLAVIYO_DEMO_LIST_ID` are Wrangler secrets in production; with either missing the form reports temporarily unavailable (the portal's graceful 503 pattern) rather than pretending.

The form works with JavaScript disabled (full-page re-render with the same states); with JS, one client island (`components/marketing/demo-form.tsx`) renders the same states inline. It is the marketing site's single justified client component.

Abuse resistance is a visually hidden honeypot (silent discard on fill) plus a KV-backed rate limit — 5 submissions per 10 minutes per IP, counters keyed by a hash of the IP with a 10-minute TTL, so no raw addresses are stored (the `RATE_LIMIT` namespace in `wrangler.jsonc`). The Workers rate-limiting binding was not used because its window options (10 or 60 seconds) cannot express 5-per-10-minutes. **Deliberately no Turnstile or any third-party challenge**: it would require loosening the CSP for an external script, and that trade-off is reported and decided, not made silently. If spam volume ever warrants it, Turnstile is the escalation path — a decision with a CSP change attached, not a default.

There is no analytics and no tracking anywhere on the form; the Klaviyo forward is the only data that leaves, which keeps the privacy policy's "no tracking" claim true.

## Environment

Copy `.env.example` to `.env.local`. `SITE_URL` feeds `metadataBase` (canonical URLs, OG URLs); `KLAVIYO_API_KEY` and `KLAVIYO_DEMO_LIST_ID` feed the contact-form forward (see above). No secrets are committed anywhere in this repo.

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
