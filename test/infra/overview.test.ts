import { describe, expect, it, vi } from 'vitest';
import { loadApp } from '../harness';

function source(sheetName: string, keys: string[]) {
  const columnKeys = [...keys];
  return {
    sheetName,
    rowNumbers: { columnKeys: 1, firstData: 2 },
    schema: {
      columnKeys,
      ensureColumns: (wanted: string[]) =>
        wanted.forEach((key) => {
          if (!columnKeys.includes(key)) columnKeys.push(key);
        }),
    },
  };
}

const forms = () => source('Forms', ['_id', 'url', 'title']);
const respondents = () => source('Respondents', ['_id', 'email', 'name']);
const scores = () => source('Scores', ['_id', 'email', 'formUrl', 'score']);

describe('columnLetter', () => {
  it('converts indexes to A1 letters', () => {
    const { app } = loadApp();

    expect([1, 26, 27, 52, 53].map((n) => app.columnLetter(n))).toEqual([
      'A',
      'Z',
      'AA',
      'AZ',
      'BA',
    ]);
  });
});

describe('buildOverviewFormula', () => {
  it('references the table columns by their position', () => {
    const { app } = loadApp();

    const formula = app.buildOverviewFormula(forms(), respondents(), scores());

    expect(formula).toContain("'Scores'!B2:B");
    expect(formula).toContain("'Scores'!D2:D");
    expect(formula).toContain('pivot Col3');
  });

  it('keeps one column per form, and uses max so duplicates never inflate', () => {
    const { app } = loadApp();

    const formula = app.buildOverviewFormula(forms(), respondents(), scores());

    expect(formula).toContain('max(Col4)');
    expect(formula).not.toContain('sum(');
    expect(formula).toContain("COUNTIF('Forms'!C2:C, 'Forms'!C2:C)>1");
    expect(formula).toContain("IF('Forms'!C2:C=\"\", 'Forms'!B2:B");
  });

  it('excludes soft-deleted scores and forms', () => {
    const { app } = loadApp();

    const formula = app.buildOverviewFormula(forms(), respondents(), scores());

    expect(formula).toContain("'Scores'!E2:E=TRUE");
    expect(formula).toContain("'Forms'!D2:D=TRUE");
    expect(formula).toContain('Col5 = 0 and Col6 = 0');
  });
});

describe('refreshOverview', () => {
  function fakeSheet(protections: unknown[] = []) {
    const protection = {
      setWarningOnly: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
    };
    const range = { setFormula: vi.fn() };
    return {
      protection,
      range,
      sheet: {
        clear: vi.fn(),
        getRange: () => range,
        setFrozenRows: vi.fn(),
        getProtections: () => protections,
        protect: () => protection,
      },
    };
  }

  const globals = { SpreadsheetApp: { ProtectionType: { SHEET: 'SHEET' } } };

  it('creates the sheet, sets the formula and adds a warning protection', () => {
    const { app } = loadApp({ globals });
    const { sheet, range, protection } = fakeSheet();
    const spreadsheet = {
      getSheetByName: () => null,
      insertSheet: vi.fn(() => sheet),
    };

    app.refreshOverview(spreadsheet, forms(), respondents(), scores());

    expect(spreadsheet.insertSheet).toHaveBeenCalledWith('Overview');
    expect(range.setFormula).toHaveBeenCalledOnce();
    expect(protection.setWarningOnly).toHaveBeenCalledWith(true);
  });

  it('reuses the sheet and does not protect it twice', () => {
    const { app } = loadApp({ globals });
    const { sheet, protection } = fakeSheet([{}]);
    const spreadsheet = {
      getSheetByName: () => sheet,
      insertSheet: vi.fn(),
    };

    app.refreshOverview(spreadsheet, forms(), respondents(), scores());

    expect(spreadsheet.insertSheet).not.toHaveBeenCalled();
    expect(sheet.clear).toHaveBeenCalled();
    expect(protection.setWarningOnly).not.toHaveBeenCalled();
  });
});
