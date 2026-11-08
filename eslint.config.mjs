// Configuration ESLint des paquets partagés (packages/*).
// Les applis (apps/mobile, apps/web) ont leur propre configuration.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/coverage/**', 'apps/**', 'supabase/**']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]);
