#!/usr/bin/env node
/**
 * Fails when a top-level function without a trailing underscore is not on the
 * public allowlist. Apps Script exposes those functions to `google.script.run`,
 * so each one must be a deliberate entry point (see ADR 0010).
 *
 * Usage: `node scripts/check-public-globals.js [dir]`. With a directory, scans
 * its `.js` files (the built `dist/`). Without one, scans the files `tsc`
 * compiles plus `src/lib/gas-libraries.js`, which the build copies verbatim.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Public entry points. Keep in sync with docs/adr/0010-private-apps-script-globals.md. */
const ALLOWLIST = new Set([
  'doGet',
  'doPost',
  'GasConfigRpc',
  'onOpen',
  'menuSettings',
  'menuInstall',
  'menuUninstall',
  'menuSystemReset',
  'menuImportDriveForms',
  'menuLinkNewForm',
  'menuRemoveForms',
  'timedSyncScores',
  'continueSyncScores',
  'seedDemoData',
  'clearDemoData',
  'migrateLegacySheets',
  't',
  'resolveLocale',
]);

/**
 * Lists `.js` files under a directory, recursively.
 * @param {string} dir Absolute directory.
 * @returns {string[]} Absolute file paths.
 */
function walkJs(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walkJs(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

/**
 * Lists the files the project's `tsconfig.json` compiles, plus the verbatim
 * library bundle.
 * @returns {string[]} Absolute file paths.
 */
function defaultFiles() {
  const configPath = join(root, 'tsconfig.json');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error)
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
  return [...parsed.fileNames, join(root, 'src/lib/gas-libraries.js')];
}

/**
 * Finds public top-level function declarations that are not allowlisted.
 * @param {string} file Absolute file path.
 * @returns {{ line: number, name: string }[]} Offending declarations.
 */
function findLeaks(file) {
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const leaks = [];
  for (const node of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(node) || !node.body || !node.name) continue;
    const name = node.name.text;
    if (name.endsWith('_') || ALLOWLIST.has(name)) continue;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    leaks.push({ line: line + 1, name });
  }
  return leaks;
}

/**
 * Runs the check and exits non-zero on any violation.
 */
function main() {
  const arg = process.argv[2];
  const files = arg ? walkJs(resolve(arg)) : defaultFiles();
  const base = arg ? resolve(arg) : root;
  const failures = files.flatMap((file) =>
    findLeaks(file).map(
      ({ line, name }) => `${relative(base, file)}:${line} ${name}`,
    ),
  );
  if (failures.length) {
    console.error(
      `Public globals not on the allowlist (add a trailing "_" or see ADR 0010):\n${failures.join('\n')}`,
    );
    process.exit(1);
  }
  console.log(`✓ Public globals check passed (${ALLOWLIST.size} allowlisted)`);
}

main();
