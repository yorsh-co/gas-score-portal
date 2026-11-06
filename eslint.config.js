import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint({
  // Legacy sources, removed as the migration to src/ progresses.
  ignores: [
    'app/**',
    'domain/**',
    'infra/**',
    'triggers/**',
    'ui/**',
    'utils/**',
    'webapp/**',
  ],
  web: {
    files: ['src/web/**/*.ts'],
    tsconfig: './tsconfig.frontend.json',
  },
});
