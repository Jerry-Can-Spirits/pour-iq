import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

// Credential tests run on workerd, not Node, because the two runtimes
// genuinely differ: Node happily runs PBKDF2 at any iteration count,
// while Workers WebCrypto caps it at 100k — a difference that shipped
// to production once (the 600k constant) precisely because the suite
// ran on Node. Runtime caps and WebCrypto behaviour must fail here,
// in CI, not at a venue's first login.
export default defineWorkersConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    poolOptions: {
      workers: {
        // The suite touches no bindings; isolated per-test storage also
        // trips a sqlite file-locking assertion on Windows.
        isolatedStorage: false,
        miniflare: {
          // No nodejs_compat: the credential module is pure WebCrypto,
          // and the flag's vm shim clashes with this pool version.
          // Date matches the newest workerd this pool bundles — asking
          // for later just triggers a fallback warning in CI.
          compatibilityDate: '2025-09-06',
        },
      },
    },
  },
})
