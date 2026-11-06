/** A Google Form linked to the system, with its stored state. */
class LinkedForm {
  url = '';
  title = '';
  maxPoints: number | null = null;
  syncedAt: Date | null = null;
  form: GoogleAppsScript.Forms.Form | null = null;

  /**
   * Creates a linked form from its stored record. The caller opens the Form.
   * @param record Stored form.
   */
  static fromRecord(record: FormRecord): LinkedForm {
    const linked = new LinkedForm();
    linked.url = record.url;
    linked.title = record.title;
    linked.maxPoints = record.maxPoints;
    linked.syncedAt = record.syncedAt;
    return linked;
  }

  /**
   * Fills the linked form from an open Form.
   * @param form Open Form.
   */
  initializeFromForm(form: GoogleAppsScript.Forms.Form): this {
    this.url = form.getEditUrl();
    this.form = form;
    this.title = form.getTitle();
    return this;
  }

  /**
   * Sums the points of every item of the quiz and stores the total.
   * @returns The maximum points.
   * @throws {Error} When the Form is not open or is not a quiz.
   */
  getMaxPoints(): number {
    if (!this.form) throw new Error(`Form is not accessible: ${this.url}`);
    if (!this.form.isQuiz()) throw new Error('Form is not a quiz');

    let maxPoints = 0;
    for (const item of this.form.getItems()) {
      try {
        maxPoints += FormUtils.getItemPoints(item);
      } catch {
        continue;
      }
    }
    this.maxPoints = maxPoints;
    return maxPoints;
  }
}
