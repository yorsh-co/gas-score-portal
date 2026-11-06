#!/usr/bin/env node
/**
 * Builds the Apps Script payload into `dist/`.
 *
 * Steps: clean `dist`, compile `src/` with tsc, inline the web UI when
 * `gasDevConfig.html` is configured, then copy non-TS assets (`*.html`)
 * and `appsscript.json` into `dist/`, preserving paths relative to `src/`.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const bin = (name) => join(root, 'node_modules', '.bin', name);

/**
 * Runs a local binary in the project root, failing the build on error.
 * @param {string} name Binary name in node_modules/.bin.
 * @param {string[]} args Arguments.
 */
function run(name, args) {
  execFileSync(bin(name), args, { cwd: root, stdio: 'inherit' });
}

/**
 * Throws when a required build input is missing.
 * @param {string} path Absolute path.
 */
function requireInput(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing build input: ${relative(root, path)}`);
  }
}

/**
 * Lists files under a directory, recursively.
 * @param {string} dir Absolute directory.
 * @returns {string[]} Absolute file paths.
 */
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Copies a file into `dist/`, creating parent directories.
 * @param {string} from Absolute source path.
 * @param {string} to Absolute destination path.
 */
function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

function build() {
  const manifest = join(root, 'appsscript.json');
  requireInput(src);
  requireInput(manifest);
  requireInput(join(src, 'lib', 'gas-libraries.js'));

  run('rimraf', ['dist']);
  run('tsc', ['-p', 'tsconfig.json']);

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.gasDevConfig?.html) {
    run('gas-dev-config', ['html']);
  }

  for (const file of walk(src)) {
    if (file.endsWith('.html')) {
      copy(file, join(dist, relative(src, file)));
    }
  }
  copy(manifest, join(dist, 'appsscript.json'));
  console.log('✓ Build complete: dist/');
}

if (process.argv.includes('--watch')) {
  const { watch } = await import('node:fs');
  build();
  let timer;
  watch(src, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        build();
      } catch (error) {
        console.error(error.message);
      }
    }, 200);
  });
} else {
  build();
}
