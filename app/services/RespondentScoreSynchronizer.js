class RespondentScoreSynchronizer {
  /**
   *
   * @param {FormsCursor} cursor
   */
  constructor(cursor) {
    this.cursor = cursor;
    this.timer = ExecutionTimer();
    this.lock = null;
    this.count = 0;
  }

  run() {
    this.timer.start();
    this.timer.setSafetyMargin(120 * 1000);

    while (!this.cursor.complete && this.timer.hasTimeLeft()) {
      let linkedForm;
      try {
        linkedForm = FormsSheet.getLinkedForm({ cursor: this.cursor });

        if (String(Config.data.gForms.excludedUrls).includes(linkedForm.url)) {
          Logger.log(
            'Skipping Form at index %s. Reason: URL is on the exclusion list: %s',
            this.cursor.formUrlIndex,
            linkedForm.url,
          );
          if (!FormsSheet.hasMoreLinkedForms(this.cursor)) {
            this.cursor.complete = true;
          }
          this.cursor.formUrlIndex++;
          continue;
        }

        this.processForm_(linkedForm);
        this.count++;

        if (!FormsSheet.hasMoreLinkedForms(this.cursor)) {
          this.cursor.complete = true;
        }
        this.cursor.formUrlIndex++;
      } catch (err) {
        console.error(err, 'Form:', JSON.stringify(linkedForm));
        if (err.toString().includes('writeScores_ timeout')) break;
        FormsSheet.updateFormStatus(linkedForm, LinkedForm.statusEnum.error, {
          error: err,
        });
      }
    }

    this.cursor.save();
    Logger.log('Synced %s forms', this.count);

    // Handle continuation.
    if (!this.cursor.complete) {
      Logger.log(
        'There are forms still to be processed. Cursor details: %s',
        JSON.stringify(this.cursor),
      );
      this.createContinuationTrigger_();
    }
    // Handle continuation.
    else {
      Logger.log('Finished syncing respondent scores for all forms');
      this.cursor.delete();
    }
  }

  /**
   *
   * @param {LinkedForm} linkedForm
   * @returns {boolean}
   */
  processForm_(linkedForm) {
    let formColNum = ScoresSheet.forms.find(linkedForm);

    const sheetScoresMap = ScoresSheet.scores.get(formColNum);

    const after = this.getAfterTimestamp_(linkedForm);

    const formScoresArr = GForms.responses.getScores(linkedForm.form, {
      after: after,
      multipleResponsesPerUser: 'newest',
    });

    const { changedScores, newScores } = this.compareScores_(
      sheetScoresMap,
      formScoresArr,
    );

    this.writeScores_(linkedForm, formColNum, changedScores, newScores);
    FormsSheet.updateFormTimestamp(linkedForm);
    FormsSheet.updateFormStatus(linkedForm, LinkedForm.statusEnum.linked);
    FormsSheet.setFormTitle(linkedForm);
  }

  /**
   *
   * @param {LinkedForm} linkedForm
   * @returns {Date}
   */
  getAfterTimestamp_(linkedForm) {
    return linkedForm.timestamp &&
      linkedForm.timestamp instanceof Date &&
      !isNaN(linkedForm.timestamp.getTime())
      ? new Date(linkedForm.timestamp.getTime() - 60 * 60 * 1000)
      : undefined;
  }

  /**
   *
   * @param {Map<string, number>} sheetScoresMap
   * @param {[{ email: string, name: string, score: number }]} formScoresArr
   *
   * @returns {{ changedScores: Map<string, object>, newScores: Map<string, object> }}
   */
  compareScores_(sheetScoresMap, formScoresArr) {
    const changedScores = new Map();
    const newScores = new Map();
    for (const formScore of formScoresArr) {
      const sheetScore = sheetScoresMap.get(formScore.email);
      if (sheetScore && sheetScore === formScore.score) continue;

      if (sheetScore || sheetScoresMap.has(formScore.email))
        changedScores.set(formScore.email, {
          email: formScore.email,
          score: formScore.score,
          name: formScore.name,
        });
      else
        newScores.set(formScore.email, {
          email: formScore.email,
          score: formScore.score,
          name: formScore.name,
        });
    }
    Logger.log(
      '%s changed scores. %s new scores.',
      changedScores.size,
      newScores.size,
    );

    return { changedScores: changedScores, newScores: newScores };
  }

  /**
   *
   * @param {LinkedForm} linkedForm
   * @param {number} formColNum
   * @param {Map<string, { email: string, score: number, name: string }>} changedScores
   * @param {Map<string, { email: string, score: number, name: string }>} newScores
   *
   * @returns {boolean}
   */
  writeScores_(linkedForm, formColNum, changedScores, newScores) {
    try {
      this.lock = ExecutionLock();
      if (
        this.lock.waitForLock(
          Math.min(this.timer.getTimeRemainingSafe(), 60 * 1000),
        )
      ) {
        if (!formColNum) formColNum = ScoresSheet.forms.insert(linkedForm);

        ScoresSheet.scores.update(formColNum, changedScores);
        ScoresSheet.scores.insert(formColNum, newScores);
        ScoresSheet.forms.setMaxPoints(formColNum, linkedForm);

        this.lock.release();
        return true;
      } else {
        console.error('writeScores_ timed out before acquiring the lock');
        throw new Error('writeScores_ timeout');
      }
    } catch (err) {
      console.error(err);
      if (this.lock) this.lock.release();
      throw new Error(err);
    }
  }

  createContinuationTrigger_() {
    TriggerUtils.createContinuation('continueSyncScores', {
      dataString: this.cursor.key,
    });
  }
}
