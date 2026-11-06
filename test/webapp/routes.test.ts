import { describe, expect, it } from 'vitest';
import { loadApp } from '../harness';

const AUTH = {
  hmac: (value: string) => value,
  otp: { request: () => undefined, verify: () => false },
  sessions: { create: () => 'token', resolve: () => null },
};

function setup() {
  const { app } = loadApp();
  const webApp = app.createWebApp({ getByUser: () => null }, AUTH);
  return { webApp };
}

/** Runs a simulated `google.script.run` call and returns the response or the thrown error message. */
function call(
  webApp: { doGet(e: object): unknown },
  route: string,
  callId?: string,
) {
  try {
    return { response: webApp.doGet({ parameter: { route, callId } }) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

describe('web app routes', () => {
  it('no longer serves scores by email', () => {
    const { error } = call(setup().webApp, '/api/users/ana@x.org/scores');

    expect(error).toMatch(/404/);
  });

  it('answers 404 for an unknown route', () => {
    const { error } = call(setup().webApp, '/nope');

    expect(error).toMatch(/404/);
  });
});

describe('entry points', () => {
  it('doGet serves the portal page when there is no route', () => {
    const calls: string[] = [];
    const output = {
      setTitle: (title: string) => (calls.push(`title:${title}`), output),
      addMetaTag: () => output,
      setFaviconUrl: (url: string) => (calls.push(`favicon:${url}`), output),
    };
    const { app } = loadApp({
      properties: { 'gasConfig:faviconUrl': '"https://x.org/f.ico"' },
      globals: {
        HtmlService: {
          createHtmlOutput: (html: string) => (calls.push(html), output),
        },
      },
    });

    const result = app.doGet({ parameter: {} });

    expect(result).toBe(output);
    expect(calls[0]).toContain('<!doctype html>');
    expect(calls).toContain('title:Score Portal');
    expect(calls).toContain('favicon:https://x.org/f.ico');
  });

  it('doGet sends a request with a route to the router', () => {
    const { app } = loadApp();

    expect(() => app.doGet({ parameter: { route: '/nope' } })).toThrow(/404/);
  });

  it('doPost goes to the router', () => {
    const { app } = loadApp();

    expect(() =>
      app.doPost({ parameter: { route: '/nope' }, postData: { contents: '' } }),
    ).toThrow(/404/);
  });
});

describe('ack tracker', () => {
  it('records the callId of a request and reports it on /ack', () => {
    const { webApp } = setup();

    call(webApp, '/nope', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const ack = webApp.doGet({
      parameter: {
        route: '/ack',
        callIds:
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
    });

    expect(ack).toMatchObject({
      ok: true,
      data: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    });
  });
});
