# Contributing

How work actually ships in this repo. The same workflow applies in the sibling `jerry-can-spirits` repo (its copy of this document differs only in commands).

## The model

Trunk-based. `main` is the only long-lived branch and auto-deploys via Cloudflare on merge. There is no `dev` branch, no release branches, no tags. Work moves in small, focused PRs that merge within minutes of passing review.

## Starting work

Every piece of work gets a fresh branch off up-to-date `origin/main`:

```bash
git fetch origin
git checkout -b feat/short-description origin/main
```

- Never branch off a stale local `main`.
- Never reuse a branch whose PR has merged — start a new one, even for a follow-up to the same feature.
- If `main` moves while you work, rebase onto `origin/main` before pushing.

Branch prefixes, matching the history: `feat/`, `fix/`, `docs/`, `chore/`.

## Before opening a PR

This repo is two projects: the marketing site at the root and the portal app in `portal/` (its own package, toolchain, and Worker). Verify whichever you touched; both if the change spans them.

Marketing site (root):

```bash
pnpm typecheck    # tsc --noEmit — must be clean
pnpm lint         # ESLint — must be clean
pnpm build        # production build — must compile
```

Portal:

```bash
cd portal
pnpm typecheck
pnpm lint
pnpm build
```

The root project's lint/typecheck/prettier deliberately exclude `portal/`. For UI changes, check affected pages at mobile (390px-class) and desktop widths — this site is mobile-first.

## The PR

- Target `main`. One concern per PR; a batch of small related tweaks is fine, unrelated work is not.
- The description says what changed and why, and states what was verified — claims of "works" without verification listed don't merge.
- CI runs lint, typecheck, and build on every push; it must be green before merge.
- Squash merge. Delete the branch after.

## Commits

Conventional prefix, imperative subject, body explains why rather than what.

## Hotfixes

Same flow, no shortcuts: branch off `origin/main`, PR, CI green, squash merge.

## Copy and content

The copy rules in `CLAUDE.md` are the highest-priority rules in this repo: provided copy is implemented byte-exact, app-capability claims are verified against the portal code, and legal copy only changes together with its date constant. Voice for any new copy follows `docs/VOICE.md`. Security-relevant changes follow `docs/SECURITY.md`.
