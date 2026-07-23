import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Flat ESLint config (ESLint 9). Focus is the classes of bug the audit found:
// React hook-dependency mistakes and unused/dead bindings. Type-aware linting
// is intentionally left off so `npm run lint` stays fast and doesn't require a
// full type-check pass (tsc already gates that in `npm run build`).
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Allow intentionally-unused args/vars when prefixed with _.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Empty `catch {}` is a deliberate best-effort idiom here (localStorage
      // cleanup, teardown) — allow it, still flag other empty blocks.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Don't demand const for a `let` that's read before its single assignment.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
    },
  },
  // Vendored ambient type shims legitimately use `any`.
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  // Test files run under Vitest globals.
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
)
