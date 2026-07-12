# Pour IQ — marketing site

The public marketing and SEO site for [Pour IQ](https://pour-iq.co.uk), the menu and cost engineering platform for independent UK bars, built by Jerry Can Spirits Ltd.

## Phase 1 / Phase 2

**Phase 1 (this codebase today): marketing only.** Static or server-rendered pages, no authentication, no app code. The Pour IQ app currently lives inside the Jerry Can Spirits site behind a licence wall.

**Phase 2 (later): the app migrates into this codebase.** The exact shape is TBC — either an authenticated route group (e.g. `app/(app)/…`) or a subdomain (`app.pour-iq.co.uk`). The structure below keeps marketing and app concerns separated from the first commit so that migration slots in without a restructure:

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

All responses carry HSTS (browsers only enforce it over HTTPS in production; its presence locally is expected), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and a CSP. Configured in `next.config.ts`.

**CSP is an interim policy**: everything is locked to `'self'` except `script-src`/`style-src`, which allow `'unsafe-inline'` because Next.js hydration requires inline scripts. A nonce-based CSP via middleware would remove `'unsafe-inline'` but forces every page to render dynamically, which is the wrong trade for a static marketing site pre-launch.

**TODO before launch:** revisit CSP — either implement nonce-based CSP via middleware and measure the rendering cost, or document acceptance of the interim policy with a dated decision. Do not ship a change that breaks hydration; verify every page loads with zero console violations after any CSP change.

(`'unsafe-eval'` appears in development only — HMR needs it. Production builds never include it.)

## Pre-launch indexing protection

Three layers keep the site out of search results until launch (robots.txt alone only controls crawling, not indexing):

1. `robots: { index: false, follow: false }` in the root metadata (`app/layout.tsx`) — renders a `noindex` meta tag on every page.
2. `X-Robots-Tag: noindex, nofollow` response header (`next.config.ts`).
3. `app/robots.ts` — robots.txt disallowing all crawling.

### Launch day — remove in this order

1. `app/layout.tsx`: delete the `robots: { index: false, follow: false }` line (and its PRE-LAUNCH comment).
2. `next.config.ts`: delete the `X-Robots-Tag` header entry (and its PRE-LAUNCH comment).
3. `app/robots.ts`: switch the rule from `disallow: '/'` to `allow: '/'`. The `sitemap` reference is already in place (`app/sitemap.ts` lists all eight routes), so no other change is needed.
4. Set `SITE_URL=https://pour-iq.co.uk` in the production environment.
5. Deploy, then verify: `curl -sI https://pour-iq.co.uk` shows **no** `X-Robots-Tag`, page source has **no** `noindex` meta, `/robots.txt` allows crawling and references the sitemap, and `/sitemap.xml` serves all eight routes.

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

## Commands

```
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm format       # Prettier write
```

Node is pinned via `.nvmrc` and the CI workflow uses the same file, so local and CI builds always run the same version. CI (GitHub Actions) runs lint, typecheck, and build on every push and pull request.
