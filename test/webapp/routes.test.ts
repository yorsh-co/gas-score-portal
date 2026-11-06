import { describe, expect, it } from 'vitest';
import { loadApp } from '../harness';

const SCORES = {
  email: 'ana@x.org',
  name: 'Ana',
  alternatives: [],
  scores: [],
};

function setup() {
  const requested: string[] = [];
  const { app } = loadApp();
  const webApp = app.createWebApp({
    getByUser: (userId: string) => {
      requested.push(userId);
      return userId === 'ana@x.org' ? SCORES : null;
    },
  });
  return { webApp, requested };
}

/** Runs a simulated `google.script.run` call and returns the response or the thrown error message. */
function call(webApp: { doGet(e: object): unknown }, route: string) {
  try {
    return { response: webApp.doGet({ parameter: { route } }) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

describe('web app routes', () => {
  it('serves the scores of a respondent', () => {
    const { webApp, requested } = setup();

    const { response } = call(webApp, '/api/users/ana@x.org/scores');

    expect(requested).toEqual(['ana@x.org']);
    expect(response).toMatchObject({ ok: true, status: 200, data: SCORES });
  });

  it('answers 404 for an unknown respondent', () => {
    const { error } = call(setup().webApp, '/api/users/bob@x.org/scores');

    expect(error).toMatch(/Respondent not found/);
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
