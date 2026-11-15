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

describe('columnLetter_', () => {
  it('converts indexes to A1 letters', () => {
    const { app } = loadApp();

    expect([1, 26, 27, 52, 53].map((n) => app.columnLetter_(n))).toEqual([
      'A',
      'Z',
      'AA',
      'AZ',
      'BA',
    ]);
  });
});

describe('buildOverviewFormula_', () => {
  it('references the table columns by their position', () => {
    const { app } = loadApp();

    const formula = app.buildOverviewFormula_(forms(), respondents(), scores());

    expect(formula).toContain("'Scores'!B2:B");
    expect(formula).toContain("'Scores'!D2:D");
    expect(formula).toContain('pivot Col3');
  });

  it('keeps one column per form, and uses max so duplicates never inflate', () => {
    const { app } = loadApp();

    const formula = app.buildOverviewFormula_(forms(), respondents(), scores());

    expect(formula).toContain('max(Col4)');
    expect(formula).not.toContain('sum(');
    expect(formula).toContain("COUNTIF('Forms'!C2:C, 'Forms'!C2:C)>1");
    expect(formula).toContain("IF('Forms'!C2:C=\"\", 'Forms'!B2:B");
  });

  it('excludes soft-deleted scores and forms', () => {
    const { app } = loadApp();

    const formula = app.buildOverviewFormula_(forms(), respondents(), scores());

    expect(formula).toContain("'Scores'!E2:E=TRUE");
    expect(formula).toContain("'Forms'!D2:D=TRUE");
    expect(formula).toContain('Col5 = 0 and Col6 = 0');
  });
});

describe('buildOverviewFormula_ in a decimal-comma locale', () => {
  const commaLocale = { arg: ';', column: '\\' };

  it('uses the locale separators outside the query string', () => {
    const { app } = loadApp();

    const formula = app.buildOverviewFormula_(
      forms(),
      respondents(),
      scores(),
      commaLocale,
    );
    const withoutQuery = formula.replace(/"select [^"]*"/, '');

    expect(withoutQuery).toContain(
      "VLOOKUP('Scores'!B2:B; {'Respondents'!B2:B\\ 'Respondents'!C2:C}; 2; FALSE)",
    );
    expect(withoutQuery).not.toContain(',');
    expect(formula).toContain('select Col1, Col2, max(Col4)');
  });
});

describe('detectFormulaSeparators_', () => {
  function probeSheet(display: string) {
    const cell = {
      setFormula: vi.fn(),
      getDisplayValue: () => display,
    };
    return { cell, sheet: { getRange: () => cell } };
  }
  const globals = { SpreadsheetApp: { flush: vi.fn() } };

  it('keeps commas when the probe formula parses', () => {
    const { app } = loadApp({ globals });
    const { sheet, cell } = probeSheet('1');

    expect(app.detectFormulaSeparators_(sheet)).toEqual({
      arg: ',',
      column: ',',
    });
    expect(cell.setFormula).toHaveBeenCalledWith('=IF(TRUE, 1, 0)');
  });

  it('switches to semicolons when the probe is a parse error', () => {
    const { app } = loadApp({ globals });

    expect(app.detectFormulaSeparators_(probeSheet('#ERROR!').sheet)).toEqual({
      arg: ';',
      column: '\\',
    });
  });
});

describe('refreshOverview_', () => {
  function fakeSheet(protections: unknown[] = []) {
    const protection = {
      setWarningOnly: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
    };
    const range = { setFormula: vi.fn(), getDisplayValue: () => '1' };
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

  const globals = {
    SpreadsheetApp: { ProtectionType: { SHEET: 'SHEET' }, flush: vi.fn() },
  };

  it('creates the sheet, sets the formula and adds a warning protection', () => {
    const { app } = loadApp({ globals });
    const { sheet, range, protection } = fakeSheet();
    const spreadsheet = {
      getSheetByName: () => null,
      insertSheet: vi.fn(() => sheet),
    };

    app.refreshOverview_(spreadsheet, forms(), respondents(), scores());

    expect(spreadsheet.insertSheet).toHaveBeenCalledWith('Overview');
    expect(range.setFormula).toHaveBeenCalledTimes(2);
    expect(range.setFormula).toHaveBeenLastCalledWith(
      expect.stringContaining('=IFERROR(QUERY('),
    );
    expect(protection.setWarningOnly).toHaveBeenCalledWith(true);
  });

  it('reuses the sheet and does not protect it twice', () => {
    const { app } = loadApp({ globals });
    const { sheet, protection } = fakeSheet([{}]);
    const spreadsheet = {
      getSheetByName: () => sheet,
      insertSheet: vi.fn(),
    };

    app.refreshOverview_(spreadsheet, forms(), respondents(), scores());

    expect(spreadsheet.insertSheet).not.toHaveBeenCalled();
    expect(sheet.clear).toHaveBeenCalled();
    expect(protection.setWarningOnly).not.toHaveBeenCalled();
  });
});
