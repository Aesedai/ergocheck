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
    // App code must query through withTenant() / withAppRole(), which run as
    // the restricted role that row-level security binds. The raw pool connects
    // as the owner, which may bypass RLS entirely (e.g. BYPASSRLS on Neon).
    files: ['src/server/**/*.ts'],
    ignores: ['src/server/db.ts', 'src/server/migrate.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db.js'],
              importNames: ['getPool'],
              message: 'Use withTenant() or withAppRole(); the raw pool may bypass row-level security.',
            },
          ],
        },
      ],
    },
  },
);
