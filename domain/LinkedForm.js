class LinkedForm {
  constructor() {
    this.url = '';
    this.title = '';

    this.points = '';
    this.timestamp = '';

    /** @type {GoogleAppsScript.Forms.Form} */
    this.form = null;
  }

  initializeFromUrl(url) {
    this.url = url;
    this.form = GForms.forms.get({ url: url });
    this.title = this.form ? this.form.getTitle() : '';

    return this;
  }

  /**
   *
   * @param {GoogleAppsScript.Forms.Form} form
   */
  initializeFromForm(form) {
    this.url = form.getEditUrl();
    this.form = form;
    this.title = form.getTitle();

    return this;
  }

  /**
   *
   * @param {object} columnReference
   * @returns {Array}
   */
  getDataArray(columnReference) {
    const arr = Array(columnReference.last).fill('');
    Object.entries(columnReference).forEach(([key, colNum]) => {
      if (Object.hasOwn(this, key)) arr[colNum - 1] = this[key];
    });
    return arr;
  }

  getRowNum() {
    const rowNum =
      FormsSheet.getLinkedFormUrls().indexOf(this.url) +
      SHEETS.forms.rows.first;
    if (!rowNum) throw new Error(`Row not found for form "${this.url}"`);
    return rowNum;
  }

  getMaxPoints() {
    if (!this.form.isQuiz()) throw new Error('Form is not a quiz');
    let maxPoints = 0;
    for (const item of this.form.getItems()) {
      const itemAsType = FormUtils.getItemAsType(item);
      if (!itemAsType) continue;
      try {
        const points = itemAsType.getPoints();
        maxPoints += points;
      } catch (err) {
        continue;
      }
    }
    this.points = maxPoints;
    Logger.log('Got max points for form %s: %s', this.url, this.points);
  }
}

LinkedForm.statusEnum = {
  excluded: {
    text: 'Consta na lista de Forms removidos',
    background: '#b7b7b7',
  },
  linked: {
    text: 'Vinculado ao sistema',
    background: '#93c47d',
  },
  invalid: {
    text: 'Não foi possível acessar o arquivo',
    background: '#e06666',
  },
  duplicate: {
    text: 'URL duplicado',
    background: '#e06666',
  },
  error: {
    text: 'Erro: {error}',
    background: '#e06666',
  },
};
