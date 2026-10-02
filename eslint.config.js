// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Imports a layer must not use, keeping dependencies pointed inwards. */
const frameworkImports = [
  '@nestjs/*',
  'fastify',
  'kysely',
  'kysely/*',
  'pg',
  'ioredis',
  'bullmq',
  'nestjs-pino',
  'grammy',
  'grammy/*',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/api/src/platform/db/generated/**',
      'tooling/screenshots/.output/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // The domain is pure: no frameworks, storage, network or UI.
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...frameworkImports, 'react', 'react-dom', 'zod', '@mestechko/*', 'node:*'] },
      ],
    },
  },
  {
    // Application layers depend on ports, never on adapters or frameworks.
    files: [
      'apps/api/src/modules/*/application/**/*.ts',
      'apps/api/src/shared/application/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...frameworkImports, '**/infrastructure/**', '**/api/**', '**/platform/**'] },
      ],
    },
  },
  {
    files: [
      'apps/miniapp/src/**/*.{ts,tsx}',
      'apps/cabinet/src/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
    ],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [...frameworkImports, 'node:*'],
          // Browsers take the schema-free entry; schemas stay on the server.
          paths: [
            { name: '@mestechko/contracts', message: 'Import from @mestechko/contracts/client.' },
          ],
        },
      ],
    },
  },
  {
    // CLI entry points report progress on the console.
    files: ['apps/api/src/cli/**/*.ts', 'tooling/**/*.ts', 'packages/contracts/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
