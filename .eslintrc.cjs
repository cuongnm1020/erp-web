/**
 * Không extend .eslintrc.cjs gốc: file gốc bật rule `no-find-unique-scoped` qua --rulesdir,
 * `next lint` không nạp được. Các rule còn lại được mirror y hệt, thêm Next.js.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module', ecmaVersion: 2022, project: './tsconfig.json' },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'next/core-web-vitals',
    'plugin:prettier/recommended',
  ],
  env: { browser: true, node: true, es2022: true },
  ignorePatterns: ['.next', 'node_modules', 'coverage', 'storybook-static', 'public', '*.js', '*.cjs', '*.mjs', 'src/lib/api/schema.d.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Luật: không commit console.log. warn/error cho phép (đi qua logger sau).
    'no-console': ['error', { allow: ['warn', 'error'] }],
    // Luật 1: web không bao giờ chạm DB.
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: '@prisma/client', message: 'Luật 1: apps/web không chạm DB.' },
          { name: 'axios', message: 'Dùng api client sinh sẵn (lib/api).' },
          { name: 'moment', message: 'Dùng formatDate/formatDateTime ở lib/format.' },
          { name: 'lodash', message: 'Import lẻ từ lodash/<fn> nếu thật sự cần.' },
        ],
      },
    ],
  },
  overrides: [
    {
      // Luật 12: components/** cấm import từ features/**.
      files: ['src/components/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['@/features/*', '**/features/*'], message: 'Luật 12: components không import features.' },
            ],
            paths: [{ name: '@prisma/client', message: 'Luật 1: apps/web không chạm DB.' }],
          },
        ],
      },
    },
    {
      // Luật 12: app/** chỉ routing — không import hook api hay client trực tiếp.
      files: ['src/app/**/*.{ts,tsx}'],
      excludedFiles: ['src/app/api/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['@/features/*/api/*'], message: 'Luật 12: page.tsx không fetch — render feature component.' },
              { group: ['@/lib/api/client', '@/lib/api/server'], message: 'Luật 12: page.tsx không gọi API trực tiếp.' },
            ],
            paths: [{ name: '@prisma/client', message: 'Luật 1: apps/web không chạm DB.' }],
          },
        ],
      },
    },
  ],
};
