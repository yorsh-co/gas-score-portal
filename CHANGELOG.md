# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tooling scaffold: TypeScript, ESLint, Prettier, Vitest and the gas-dev-\* toolchain.
- Build pipeline: `scripts/build.js` compiles `src/` to `dist/`; bundled gas-\* libraries and the vendored gas-webapp browser client.

### Changed

- Legacy sources moved under `src/`; legacy HTML docs moved to `docs/legacy/`.

### Removed

- `.claspignore`, replaced by `.clasp.json` with `rootDir: dist`.
