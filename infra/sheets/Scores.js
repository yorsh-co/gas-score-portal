const ScoresSheet = (() => {
  const sheetDef = SHEETS.scores;
  const sheet = SS.getSheetByName(sheetDef.name);

  const respondents = Object.freeze({
    /**
     *
     * @param {string} email
     * @returns {number}
     */
    find(email) {
      // Get the respondent row.
      const respondents = sheet
        .getRange(
          sheetDef.rows.first,
          sheetDef.cols.email,
          sheet.getLastRow() - (sheetDef.rows.first - 1),
          1,
        )
        .getValues()
        .map((r) => r[0]);
      const respondentIndex = respondents.indexOf(email);
      if (respondentIndex === -1) {
        console.error('Respondent not found in scores sheet');
        return null;
      }
      return respondentIndex + sheetDef.rows.first;
    },

    /**
     *
     * @param {string} email
     * @returns {[number]}
     */
    findAlternatives(email) {
      const allAlternatives = sheet
        .getRange(
          sheetDef.rows.first,
          sheetDef.cols.alternatives,
          sheet.getLastRow() - (sheetDef.rows.first - 1),
          1,
        )
        .getValues()
        .map((r) => r[0]);
      return allAlternatives
        .map((v, i) => (v.toString().includes(email) ? i : -1))
        .filter((i) => i > -1)
        .map((i) => i + sheetDef.rows.first);
    },
  });

  const forms = Object.freeze({
    /**
     *
     * @param {LinkedForm} linkedForm
     *
     * @returns {number}
     */
    find(linkedForm, { insertIfMissing = false } = {}) {
      const numUrls = sheet.getLastColumn() - (sheetDef.cols.first - 1);
      if (numUrls < 1) return null;

      const formUrls = sheet
        .getRange(
          sheetDef.rows.url,
          sheetDef.cols.first,
          1,
          sheet.getLastColumn() - (sheetDef.cols.first - 1),
        )
        .getValues()[0];
      const formIndex = formUrls.indexOf(linkedForm.url);

      let formColNum;
      if (formIndex >= 0) {
        formColNum = formIndex + sheetDef.cols.first;
      } else {
        Logger.log(
          'Form URL %s not found in scores sheet. The form may have been newly linked, or may not have any responses yet',
          linkedForm.url,
        );
        if (insertIfMissing) formColNum = this.insert(linkedForm);
      }

      return formColNum;
    },

    /**
     *
     * @param {LinkedForm} linkedForm
     *
     * @returns {number}
     */
    insert(linkedForm) {
      // Insert the column.
      const lastCol =
        sheet
          .getRange(
            sheetDef.rows.url,
            sheetDef.cols.first,
            1,
            sheet.getLastColumn(),
          )
          .getValues()[0]
          .filter(Boolean).length +
        SHEETS.scores.cols.first -
        1;
      const maxCols = sheet.getMaxColumns();
      const needed = lastCol + 1 - maxCols;
      if (needed > 0) {
        sheet.insertColumnsAfter(lastCol, needed);
        format();
      }
      const formColNum = lastCol + 1;

      // Add the form url to the header.
      sheet.getRange(sheetDef.rows.url, formColNum).setValue(linkedForm.url);
      Logger.log(
        'Inserted new form column to scores sheet at col %s. Form details: %s',
        formColNum,
        JSON.stringify(linkedForm),
      );

      return formColNum;
    },

    /**
     *
     * @param {number} formColNum
     * @param {LinkedForm} linkedForm
     */
    setMaxPoints(formColNum, linkedForm) {
      linkedForm.getMaxPoints();
      sheet
        .getRange(sheetDef.rows.points, formColNum)
        .setValue(linkedForm.points);
    },
  });

  const scores = Object.freeze({
    /**
     *
     * @param {number} formColNum
     *
     * @returns {Map<string, number>}
     */
    get(formColNum) {
      // Get the score data.
      const numEntries = sheet.getLastRow() - (sheetDef.rows.first - 1);
      const formScoresArr =
        formColNum && numEntries > 0
          ? sheet
              .getRange(sheetDef.rows.first, formColNum, numEntries, 1)
              .getValues()
          : [];
      const respondentEmailsArr =
        numEntries > 0
          ? sheet
              .getRange(sheetDef.rows.first, sheetDef.cols.email, numEntries, 1)
              .getValues()
          : [];

      const scoresByRespondent = new Map();
      for (let i = 0; i < respondentEmailsArr.length; i++) {
        scoresByRespondent.set(
          respondentEmailsArr[i][0],
          i < formScoresArr.length ? formScoresArr[i][0] : '',
        );
      }
      Logger.log(
        'Pulled scores for %s respondents from the sheet for form in column %s',
        scoresByRespondent.size,
        formColNum,
      );

      return scoresByRespondent;
    },

    /**
     *
     * @param {number} formColNum
     * @param {Map<string, { score: number, name: string }>} scoresMap
     */
    update(formColNum, scoresMap) {
      if (!scoresMap.size) {
        Logger.log('No changed scores to update');
        return;
      }

      const respondentEmailsArr = sheet
        .getRange(1, sheetDef.cols.email, sheet.getLastRow(), 1)
        .getValues()
        .map((r) => r[0]);

      const scoresWithoutMatches = new Map();

      for (const key of scoresMap.keys()) {
        const score = scoresMap.get(key);
        let rowNum = respondentEmailsArr.indexOf(key) + 1;
        if (rowNum) {
          sheet.getRange(rowNum, formColNum).setValue(score.score);
          sheet.getRange(rowNum, sheetDef.cols.name).setValue(score.name);
        } else {
          scoresWithoutMatches.set(key, score);
        }
      }
      Logger.log(
        'Updated %s entries',
        scoresMap.size - scoresWithoutMatches.size,
      );

      if (scoresWithoutMatches.size) {
        console.error(
          'No sheet entries were found for',
          scoresWithoutMatches.size,
          'updated scores',
          Array.from(scoresWithoutMatches.keys()),
        );
        Logger.log('Inserting as new entries...');
        this.insert(formColNum, scoresWithoutMatches);
      }
    },

    /**
     *
     * @param {number} formColNum
     * @param {Map<string, { score: number, name: string }>} scoresMap
     */
    insert(formColNum, scoresMap) {
      if (!scoresMap.size) {
        Logger.log('No new scores to insert');
        return;
      }

      const dataArr = [];
      for (const key of scoresMap.keys()) {
        const score = scoresMap.get(key);
        const rowArr = Array(formColNum).fill('');
        rowArr[sheetDef.cols.email - 1] = key;
        rowArr[sheetDef.cols.name - 1] = score.name;
        rowArr[formColNum - 1] = score.score;
        dataArr.push(rowArr);
      }

      const lastRow = Math.max(sheet.getLastRow(), sheetDef.rows.first);
      const maxRows = sheet.getMaxRows() - 1;
      const needed = lastRow + dataArr.length - maxRows;
      if (needed > 0) {
        sheet.insertRowsAfter(lastRow, needed);
        format();
      }
      sheet
        .getRange(lastRow + 1, 1, dataArr.length, dataArr[0].length)
        .setValues(dataArr);
      Logger.log(
        'Inserted %s new scores at row %s',
        dataArr.length,
        lastRow + 1,
      );
    },
  });

  const values = Object.freeze({
    /**
     *
     * @param {number} params
     * @param {number} params.rowNum
     * @param {string} params.rowKey
     * @returns {Array}
     */
    getRow({ rowNum, rowKey } = {}) {
      const row = rowNum || sheetDef.rows[rowKey];
      if (!row) throw new Error('Invalid row');
      const numCols = sheet.getLastColumn() - (sheetDef.cols.first - 1);
      return sheet
        .getRange(row, sheetDef.cols.first, 1, numCols)
        .getValues()[0];
    },

    /**
     *
     * @param {object} params
     * @param {object} params.rowNum
     * @param {object} params.rowKey
     * @param {object} params.colNum
     * @param {object} params.colKey
     */
    getCell({ rowNum, rowKey, colNum, colKey } = {}) {
      const row = rowNum || sheetDef.rows[rowKey];
      if (!row) throw new Error('Invalid row');
      const col = colNum || sheetDef.cols[colKey];
      if (!col) throw new Error('Invalid column');

      return sheet.getRange(row, col).getValue();
    },
  });

  

  /**
   *
   */
  const format = () => {
    // Format form columns.
    const numCols = sheet.getLastColumn() - (sheetDef.cols.first - 1);
    if (numCols > 0) {
      sheet
        .getRange(1, sheetDef.cols.first, sheet.getMaxRows() - 1, numCols)
        .setBorder(
          false,
          true,
          false,
          true,
          true,
          false,
          '#d9d9d9',
          SpreadsheetApp.BorderStyle.SOLID,
        )
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
      sheet
        .getRange(sheetDef.rows.url, sheetDef.cols.first, 1, numCols)
        .setHorizontalAlignment('left');
      sheet
        .getRange(sheetDef.rows.title, sheetDef.cols.first, 1, numCols)
        .setWrap(true);
    }

    // Format respondent rows.
    const numRows = sheet.getMaxRows() - 1 - (sheetDef.rows.first - 1);
    if (numRows > 0) {
      sheet
        .getRange(sheetDef.rows.first, 1, numRows, sheet.getMaxColumns())
        .setBorder(
          false,
          true,
          false,
          true,
          true,
          false,
          '#d9d9d9',
          SpreadsheetApp.BorderStyle.SOLID,
        )
        .setFontColor(null)
        .setFontWeight('normal');
      sheet
        .getRange(sheetDef.rows.first, 1, numRows, sheetDef.cols.first - 1)
        .setHorizontalAlignment('left');
      sheet
        .getRange(
          sheetDef.rows.first,
          sheetDef.cols.first,
          numRows,
          sheet.getMaxColumns() - (sheetDef.cols.first - 1),
        )
        .setHorizontalAlignment('center');
    }
  };

  return Object.freeze({
    respondents,
    forms,
    scores,
    values,
    format
  });
})();
