import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../scripts/check-public-globals.js');
const dirs: string[] = [];

/**
 * Runs the check against a temporary directory holding one file.
 * @param source Contents of `code.js`.
 */
const runOn = (source: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'public-globals-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'code.js'), source);
  return spawnSync('node', [script, dir], { encoding: 'utf8' });
};

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('check-public-globals', () => {
  it('fails on a public function that is not allowlisted', () => {
    const result = runOn('function leakyHelper() {}\n');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('leakyHelper');
    expect(result.stderr).toContain('code.js');
  });

  it.each([
    'async function leaky() {}',
    'function* leaky() {}',
    'export function leaky() {}',
  ])('fails on `%s`', (source) => {
    const result = runOn(`${source}\n`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('leaky');
  });

  it('passes allowlisted, private, nested and non-function declarations', () => {
    const result = runOn(
      [
        'function doGet() {}',
        'function helper_() {}',
        'async function other_() {}',
        'function outer_() { function inner() {} }',
        'const x = () => 1;',
      ].join('\n'),
    );
    expect(result.status).toBe(0);
  });

  it('passes against the repository', () => {
    const result = spawnSync('node', [script], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
