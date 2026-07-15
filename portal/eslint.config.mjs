import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import prettierConfig from 'eslint-config-prettier'

// The portal's own flat config. Before this file existed, a bare
// `eslint` here walked up to the root config and resolved the root's
// eslint-config-next cross-tree, which died in the rushstack patch
// ("calling module was not recognized") — lint had been silently
// non-functional in portal/ since the migration.

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'cloudflare-env.d.ts',
      'cloudflare-worker-entry.mjs',
    ],
  },
]

export default eslintConfig
