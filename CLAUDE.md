# Pour IQ — Claude Code Instructions

## Copy rules — highest priority in this repo

- Copy on this site is final as provided. Implement it byte-exact: no additions, no substitutions, no tone edits.
- If implementation reveals a copy claim that conflicts with shipped code (the Pour IQ app lives in `portal/` in this repo), stop and report the conflict. Do not rewrite copy in the PR.
- Legal page copy and the `lib/legal.ts` dates change only together and only on explicit instruction: any task that modifies legal copy must update the corresponding date constant in the same commit, and no task may change the date without a copy change.

---

## The document set

Four documents govern work here. This file is the working contract; read the others when their territory comes up, and treat them as binding:

- `docs/VOICE.md` — the Pour IQ voice, derived from the shipped copy. **Read it before writing any customer-facing words**, including portal microcopy. It also carries the claims discipline (only sell what is built; never claim cross-venue price benchmarking).
- `docs/SECURITY.md` — the security baseline and where both surfaces of this repo stand against it. Read it before touching anything security-relevant.
- `docs/CONTRIBUTING.md` — the actual git workflow in detail.
- `README.md` — structure, design tokens, brand assets, pre-launch indexing state, environment. Operational reference; keep it current when those areas change.

---

## What this repo is

Two projects, one repo:

- **Marketing site** (root) — the public site at pour-iq.co.uk. Next.js 15 (App Router), Tailwind v4 configured in CSS, pnpm, deployed as Cloudflare Worker `pour-iq` via OpenNext. Pre-launch: noindex everywhere (see README for the launch-day checklist). Loads zero third-party scripts.
- **Portal** (`portal/`) — the authenticated Pour IQ app at app.pour-iq.co.uk. Its own Next.js project, `package.json`, toolchain, and `wrangler.jsonc`; its own Worker (`pour-iq-portal`) with D1 (`pour-iq-db`), KV, and R2, all WEUR. Work inside it with `cd portal && pnpm <script>`. The root project's lint/typecheck/prettier deliberately exclude it.

Marketing pages go in `app/(marketing)/`, never in `app/` root. Marketing-only components in `components/marketing/`; shared ones in `components/shared/` (when in doubt, start in `marketing` and promote later). Non-UI code in `lib/`.

---

## Coding standards

- TypeScript throughout. No `any` unless unavoidable, use `unknown` with a cast instead.
- Do not create new files unless genuinely necessary. Prefer editing existing files.
- Do not add comments, docstrings, or type annotations to code that was not changed.
- Do not add error handling for scenarios that cannot happen.
- Do not over-engineer. The minimum complexity that solves the problem is correct.
- Tailwind utilities only, consuming tokens — no hand-written colour or spacing values (`lib/design-tokens.ts` is the source; see README).
- Server components by default. `'use client'` only when interactivity requires it.
- Mobile-first: base styles target 390px-class viewports; widen with `sm:`/`md:`/`lg:` only.

---

## Git workflow — non-negotiable

Trunk-based: every piece of work gets a fresh branch off up-to-date `origin/main`, ships as a PR to `main`, and merges only with CI green. Never commit directly to main; never reuse a merged branch. Full detail: `docs/CONTRIBUTING.md`.

```
git fetch origin && git checkout -b feat/description-of-work origin/main
```

Verify before the PR: `pnpm typecheck && pnpm lint && pnpm build` at the root, and the same inside `portal/` if you touched it.

---

## Writing — the hard rules

Full reference: `docs/VOICE.md`. The short version:

- No exclamation marks. No hype language. Sentence-case headings ending in a full stop.
- One CTA per piece of content. Write to one venue owner, not a crowd.
- Only sell what is built. Never claim cross-venue price benchmarking — no feature shows one venue's prices to another venue or to us, and copy must never contradict that.
- The customer is a venue. The product is Pour IQ, always the subject of active verbs. The mark is registered (UK00004387466), so the symbol is `®`, never `™`: on the first prominent use of a page — the site header, the portal wordmark — and in the legal notices. Subsequent mentions in body copy stay plain.

---

## Cross-repo sessions

The sibling repo (`../jerry-can-spirits`) is granted via `additionalDirectories` in `.claude/settings.json`. The sibling's CLAUDE.md does NOT load automatically: before editing any file in the sibling repo, read its CLAUDE.md first and obey it, treating its rules as binding for any files edited there.
