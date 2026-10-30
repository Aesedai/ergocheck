import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.vercel'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Tenant-scoped code must go through withTenant(), which sets the org for
    // row-level security. A raw pool query from here would run without it.
    files: ['src/server/routes/**/*.ts', 'src/server/repos/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db.js'],
              importNames: ['getPool'],
              message: 'Use withTenant() for tenant data; only auth/migrate/seed may use the raw pool.',
            },
          ],
        },
      ],
    },
  },
);
