#!/usr/bin/env node
/**
 * Regenerates the README screenshots in `docs/screenshots/`.
 *
 * Serves the built portal HTML from a routed fake origin with
 * `google.script.run` stubbed to return fixture data, then captures each
 * view with Playwright. Run through `npm run screenshots`, which builds first.
 */
/* global window, document */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlModule = join(root, 'dist', 'generated', 'portal.html.js');
const outDir = join(root, 'docs', 'screenshots');
const ORIGIN = 'https://portal.test';
const TOKEN = 'fixture-session-token';
const SCALE = 2;

/** Fixture for `GET /api/meta`; null brand and legal fields render the defaults. */
const META = {
  locale: 'en',
  portalTitle: 'Score Portal',
  brand: {
    primaryColor: null,
    secondaryColor: null,
    logoUrl: null,
    faviconUrl: null,
  },
  legal: { privacyPolicyUrl: null, termsUrl: null },
};

/** Fixture for `GET /api/me/scores`. */
const SCORES = {
  email: 'ada.lovelace@example.com',
  name: 'Ada Lovelace',
  alternatives: ['ada@example.com'],
  scores: [
    { formTitle: 'Module 1: Foundations', formPoints: 100, score: 92 },
    { formTitle: 'Module 2: Data Structures', formPoints: 100, score: 85 },
    { formTitle: 'Module 3: Algorithms', formPoints: 80, score: 64 },
    { formTitle: 'Module 4: Databases', formPoints: 100, score: 78 },
    { formTitle: 'Module 5: Networking', formPoints: 50, score: 41 },
    { formTitle: 'Final Project Survey', formPoints: null, score: null },
  ],
};

/**
 * Capture definitions: output file, viewport, colour scheme, whether a session
 * is resumed, and whether to capture the full page instead of the viewport.
 */
const SHOTS = [
  {
    file: 'sign-in-light.png',
    viewport: { width: 1024, height: 640 },
    scheme: 'light',
    signedIn: false,
  },
  {
    file: 'results-light.png',
    viewport: { width: 1024, height: 859 },
    scheme: 'light',
    signedIn: true,
    fullPage: true,
  },
  {
    file: 'results-dark.png',
    viewport: { width: 1024, height: 859 },
    scheme: 'dark',
    signedIn: true,
    fullPage: true,
  },
  {
    file: 'results-mobile.png',
    viewport: { width: 360, height: 800 },
    scheme: 'light',
    signedIn: true,
  },
];

/**
 * Reads the portal HTML exactly as Apps Script serves it.
 * @returns {string} The inlined portal document.
 */
function loadPortalHtml() {
  if (!existsSync(htmlModule)) {
    throw new Error(
      `Missing ${htmlModule}. Run \`npm run build\` first (or use \`npm run screenshots\`).`,
    );
  }
  const html = vm.runInNewContext(
    `${readFileSync(htmlModule, 'utf8')}\n_PORTAL_HTML;`,
  );
  if (typeof html !== 'string') {
    throw new Error('_PORTAL_HTML was not found in the generated module.');
  }
  return html;
}

/**
 * Browser-side init script: stubs `google.script.run` and optionally seeds a
 * session token. Runs before any page script.
 * @param {{ meta: object, scores: object, token: string | null }} args Fixtures.
 */
function installStub({ meta, scores, token }) {
  const respond = (event) => {
    const { route, callIds } = event.parameter;
    switch (route) {
      case '/api/meta':
        return { data: meta };
      case '/api/me/scores':
        return { data: scores };
      case '/ack':
        return { data: callIds ? callIds.split(',') : [] };
      case '/api/client-errors':
        return { data: {} };
      default:
        throw new Error(`Unstubbed route: ${route}`);
    }
  };
  const runner = (onSuccess, onFailure) => {
    const call = (event) => {
      setTimeout(() => {
        try {
          const value = respond(event);
          if (onSuccess) onSuccess(value);
        } catch (err) {
          window.__unstubbed = [
            ...(window.__unstubbed ?? []),
            event.parameter.route,
          ];
          if (onFailure) onFailure(err);
        }
      }, 0);
    };
    return {
      withSuccessHandler: (fn) => runner(fn, onFailure),
      withFailureHandler: (fn) => runner(onSuccess, fn),
      doGet: call,
      doPost: call,
    };
  };
  window.google = { script: { run: runner() } };
  if (token) window.sessionStorage.setItem('portal.token', token);
}

/**
 * Captures one screenshot.
 * @param {import('playwright').Browser} browser Shared browser.
 * @param {string} html Portal document.
 * @param {(typeof SHOTS)[number]} shot Capture definition.
 * @param {string[]} problems Collector for console errors and unstubbed routes.
 */
async function capture(browser, html, shot, problems) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: SCALE,
    colorScheme: shot.scheme,
    timezoneId: 'UTC',
  });
  try {
    await context.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        problems.push(`${shot.file}: console error: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      problems.push(`${shot.file}: page error: ${err.message}`);
    });
    await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
    await page.addInitScript(installStub, {
      meta: META,
      scores: SCORES,
      token: shot.signedIn ? TOKEN : null,
    });
    await page.goto(`${ORIGIN}/`);
    await page
      .locator(shot.signedIn ? '#results-panel' : '#send-btn:not([disabled])')
      .waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    const readUnstubbed = () => page.evaluate(() => window.__unstubbed ?? []);
    const unstubbed = new Set(await readUnstubbed());
    await page.screenshot({
      path: join(outDir, shot.file),
      fullPage: shot.fullPage ?? false,
      animations: 'disabled',
      caret: 'hide',
    });
    (await readUnstubbed()).forEach((route) => unstubbed.add(route));
    unstubbed.forEach((route) =>
      problems.push(`${shot.file}: unstubbed route ${route}`),
    );
  } finally {
    await context.close();
  }
}

/** Entry point: captures every shot and exits non-zero on any problem. */
async function main() {
  const html = loadPortalHtml();
  mkdirSync(outDir, { recursive: true });
  const problems = [];
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      await capture(browser, html, shot, problems);
      console.log(`✓ ${shot.file}`);
    }
  } finally {
    await browser.close();
  }
  if (problems.length > 0) {
    throw new Error(`Screenshot run had problems:\n${problems.join('\n')}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
