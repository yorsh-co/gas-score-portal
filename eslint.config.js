import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint({
  // Bundled/vendored code and legacy JS sources (removed as the TS migration progresses).
  ignores: [
    'src/lib/**',
    'src/web/vendor/**',
    'src/**/*.js',
    'types/gas-libraries.d.ts',
  ],
  web: {
    files: ['src/web/**/*.ts'],
    tsconfig: './tsconfig.frontend.json',
  },
});
