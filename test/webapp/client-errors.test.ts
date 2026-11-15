import { describe, expect, it, vi } from 'vitest';
import { loadApp } from '../harness';

function setup() {
  const { app } = loadApp();
  const webApp = app.createWebApp_(
    { getByUser: () => null },
    app.createAuthServices_(() => ({ findByEmail: () => null }), {
      error: () => undefined,
    }),
  );
  const report = (body: object) =>
    webApp.doPost({
      parameter: { route: '/api/client-errors' },
      postData: { contents: JSON.stringify(body), type: 'application/json' },
    }) as unknown as { ok: boolean; status: number; data: unknown };
  return { report };
}

const VALID = { kind: 'logged', scope: 'Portal', message: 'boom' };

describe('POST /api/client-errors', () => {
  it('accepts a valid report without a session', () => {
    const { report } = setup();

    expect(report(VALID)).toMatchObject({
      ok: true,
      status: 202,
      data: { received: true },
    });
  });

  it('rejects a report with no message or an unknown kind', () => {
    const { report } = setup();

    expect(() => report({ kind: 'logged', scope: 'Portal' })).toThrow(
      /Client error report needs a message.*"status":400/,
    );
    expect(() => report({ ...VALID, kind: 'nope' })).toThrow(
      /Invalid client error kind.*"status":400/,
    );
  });

  it('answers 429 after 30 reports in a window', () => {
    const { report } = setup();

    for (let i = 0; i < 30; i++) report(VALID);

    expect(() => report(VALID)).toThrow('Too many requests (30/60s)');
  });

  it('masks emails in the logged message and url', () => {
    const { entries, report } = capture();

    report({
      ...VALID,
      message: 'failed for ana@x.org',
      url: 'https://x/?email=ana@x.org',
      stack: 'Error at ana@x.org',
      context: { user: 'ana@x.org' },
    });

    const out = JSON.stringify(findClient(entries));
    expect(out).toContain('"module":"client"');
    expect(out).toContain('@x.org');
    expect(out).not.toContain('ana@x.org');
  });

  it('logs the client text as clientMessage, masked', () => {
    const { entries, report } = capture();

    report({ ...VALID, message: 'failed for ana@x.org' });

    expect(findClient(entries)).toMatchObject({
      message: 'Client error: Portal',
      clientMessage: 'failed for an...@x.org',
    });
  });

  it('masks emails in the client-supplied scope', () => {
    const { entries, report } = capture();

    report({ ...VALID, scope: 'ana@x.org' });

    expect(findClient(entries)).toMatchObject({
      message: 'Client error: an...@x.org',
    });
  });

  it('does not throw when logging a circular meta beyond the depth limit', () => {
    const { app } = loadApp();
    const circular: Record<string, unknown> = {};
    circular.self = { a: { b: { c: { d: circular } } } };
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(() => undefined),
    );

    try {
      expect(() =>
        app.createRedactedLogger_().error('boom', { circular }),
      ).not.toThrow();
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('masks a long log field in linear time', () => {
    const { app } = loadApp();
    const entries: unknown[] = [];
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (m) =>
        vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
          entries.push(...args);
        }),
    );
    const start = Date.now();

    try {
      app.createRedactedLogger_().error('boom', {
        x: `ana@x.org ${'a'.repeat(50_000)}`,
      });
    } finally {
      spies.forEach((s) => s.mockRestore());
    }

    expect(Date.now() - start).toBeLessThan(1000);
    const out = JSON.stringify(entries);
    expect(out).toContain('an...@x.org');
    expect(out).not.toContain('ana@x.org');
  });

  it('masks emails nested beyond the depth limit in context', () => {
    const { entries, report } = capture();

    report({
      ...VALID,
      context: { a: { b: { c: { d: { e: { note: 'ana@x.org' } } } } } },
    });

    expect(JSON.stringify(findClient(entries))).not.toContain('ana@x.org');
  });
});

function capture() {
  const { report } = setup();
  const entries: unknown[] = [];
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      entries.push(...args);
    }),
  );
  return {
    entries,
    report: (body: object) => {
      try {
        return report(body);
      } finally {
        spies.forEach((s) => s.mockRestore());
      }
    },
  };
}

function findClient(entries: unknown[]) {
  return entries
    .map((e) =>
      typeof e === 'string' && e.startsWith('{') ? JSON.parse(e) : e,
    )
    .find((e) => (e as { module?: string })?.module === 'client');
}
