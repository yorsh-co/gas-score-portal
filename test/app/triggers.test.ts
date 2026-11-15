import { describe, expect, it } from 'vitest';
import { loadApp, WEB_APP_VISITORS, webAppSession } from '../harness';

describe('FormsCursor', () => {
  it('initialize saves a new cursor and removes the earlier ones of the user', () => {
    const prefix = 'cursor:FORMS_RESPONSES:me@x.org:';
    const { app, properties } = loadApp({
      activeUser: 'me@x.org',
      properties: {
        [`${prefix}2020-01-01T00:00:00.000Z`]: '{}',
        'cursor:FORMS_RESPONSES:other@x.org:2020': '{}',
        unrelated: 'keep',
      },
    });

    const cursor = app.FormsCursor.initialize();

    expect(cursor.key.startsWith(prefix)).toBe(true);
    expect(properties.getKeys().sort()).toEqual(
      [
        cursor.key,
        'cursor:FORMS_RESPONSES:other@x.org:2020',
        'unrelated',
      ].sort(),
    );
  });

  it('deleteTrailing keeps the given key', () => {
    const { app, properties } = loadApp({
      properties: { 'cursor:a': '1', 'cursor:b': '2' },
    });

    app.FormsCursor.deleteTrailing('cursor:', 'cursor:b');

    expect(properties.getKeys()).toEqual(['cursor:b']);
  });
});

describe('TriggerUtils continuations', () => {
  it('stores the data under the trigger ID and removes it when consumed', () => {
    const { app, properties, triggers } = loadApp();

    const id = app.TriggerUtils.createContinuation('continueSyncScores', {
      dataString: 'cursor:key',
    });

    expect(properties.getProperty(`continuation:${id}`)).toBe('cursor:key');
    expect(triggers).toHaveLength(1);

    expect(app.TriggerUtils.consumeContinuation(id)).toBe('cursor:key');
    expect(properties.getKeys()).toEqual([]);
    expect(triggers).toHaveLength(0);
  });

  it('deleteContinuations removes the pending triggers and all stored data', () => {
    const { app, properties, triggers } = loadApp();
    app.TriggerUtils.createContinuation('continueSyncScores', {
      dataString: 'a',
    });
    app.TriggerUtils.createContinuation('continueSyncScores', {
      dataString: 'b',
    });
    properties.setProperty('continuation:stale', 'c');

    app.TriggerUtils.deleteContinuations('continueSyncScores');

    expect(triggers).toHaveLength(0);
    expect(properties.getKeys()).toEqual([]);
  });

  it('isProjectTrigger matches only a project trigger of the handler', () => {
    const { app } = loadApp();
    const id = app.TriggerUtils.createContinuation('continueSyncScores');

    expect(app.TriggerUtils.isProjectTrigger(id, 'continueSyncScores')).toBe(
      true,
    );
    expect(app.TriggerUtils.isProjectTrigger(id, 'timedSyncScores')).toBe(
      false,
    );
    expect(
      app.TriggerUtils.isProjectTrigger('forged', 'continueSyncScores'),
    ).toBe(false);
    expect(
      app.TriggerUtils.isProjectTrigger(undefined, 'continueSyncScores'),
    ).toBe(false);
  });
});

describe('continueSyncScores', () => {
  it('returns without error when the cursor is missing, and consumes the trigger', () => {
    const { app, properties, triggers } = loadApp();
    const id = app.TriggerUtils.createContinuation('continueSyncScores', {
      dataString: 'cursor:gone',
    });

    expect(() => app.continueSyncScores({ triggerUid: id })).not.toThrow();

    expect(triggers).toHaveLength(0);
    expect(properties.getKeys()).toEqual([]);
  });

  it('ignores an event that names no continuation trigger', () => {
    const { app, properties, triggers } = loadApp();
    const id = app.TriggerUtils.createContinuation('continueSyncScores', {
      dataString: 'cursor:key',
    });
    const other = app.TriggerUtils.createContinuation('timedSyncScores', {
      dataString: 'other',
    });

    app.continueSyncScores({ triggerUid: 'forged' });
    app.continueSyncScores({ triggerUid: other });

    expect(triggers).toHaveLength(2);
    expect(properties.getProperty(`continuation:${id}`)).toBe('cursor:key');
    expect(properties.getProperty(`continuation:${other}`)).toBe('other');
  });
});

describe('timedSyncScores', () => {
  it.each(WEB_APP_VISITORS)(
    'ignores a web app call by %s, keeping the cursor in progress',
    (_, visitor) => {
      const key = 'cursor:FORMS_RESPONSES:owner@x.org:2020-01-01T00:00:00.000Z';
      const { app, properties, triggers } = loadApp({
        properties: { [key]: '{}' },
        globals: { Session: webAppSession(visitor) },
      });
      const id = app.TriggerUtils.createContinuation('continueSyncScores', {
        dataString: key,
      });

      expect(() => app.timedSyncScores()).not.toThrow();
      expect(() => app.timedSyncScores({ triggerUid: id })).not.toThrow();

      expect(properties.getProperty(key)).toBe('{}');
      expect(triggers).toHaveLength(1);
    },
  );
});

describe('installTriggers', () => {
  it.each(WEB_APP_VISITORS)(
    'rejects a web app call by %s, keeping the triggers',
    (_, visitor) => {
      const { app, triggers } = loadApp({
        globals: { Session: webAppSession(visitor) },
      });
      app.TriggerUtils.createContinuation('timedSyncScores');

      expect(() => app.installTriggers()).toThrow(/Forbidden/);
      expect(triggers).toHaveLength(1);
    },
  );

  it('installs the trigger for a user running the script themselves', () => {
    const created: string[] = [];
    const { app } = loadApp({
      activeUser: 'owner@x.org',
      globals: {
        ScriptApp: {
          getProjectTriggers: () => [],
          newTrigger: (handler: string) => ({
            timeBased: () => ({
              everyMinutes: () => ({
                create: () => void created.push(handler),
              }),
            }),
          }),
        },
      },
    });

    app.installTriggers();

    expect(created).toEqual(['timedSyncScores']);
  });
});

describe('menuImportDriveForms', () => {
  it.each(WEB_APP_VISITORS)(
    'rejects a web app call by %s before importing',
    (_, visitor) => {
      const { app, toasts } = loadApp({
        globals: { Session: webAppSession(visitor) },
      });

      expect(() => app.menuImportDriveForms()).toThrow(/Forbidden/);
      expect(toasts).toHaveLength(1);
      expect(toasts[0]).toMatchObject({ message: 'Forbidden', timeout: 15 });
    },
  );
});
