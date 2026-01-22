import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**',
      '.tmp/**',
      'node_modules/**',
      'codecs/**',
      'lib/**',
      '**/*.d.ts',
    ],
  },
  {
    files: ['src/cli/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './cli-tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'no-console': 'off', // CLI needs console output
    },
  },
);
