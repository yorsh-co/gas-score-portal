const GSheetsUiUtils = {
  /**
   * Displays a UI prompt requesting user input.
   * @param {string} title
   * @param {string} body
   * @param {string} warning
   * @param {object} options
   * @param {boolean} options.acceptBlank
   * @returns {string}
   */
  promptForValue(title, body, warning, { acceptBlank = false } = {}) {
    const ui = SpreadsheetApp.getUi();
    let prompt = body ? body : `Insira o ${title}`;
    prompt = warning ? prompt + `\n\n⚠️ ${warning}` : prompt;

    const response = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() !== ui.Button.OK)
      throw new Error('Cancelado pelo usuário');

    let input = response.getResponseText().trim();
    if (!acceptBlank && (!input || !input.length))
      input = promptForValue(title, body, 'Esse campo não pode ficar vazio');

    Logger.log('User responded to prompt "%s": "%s"', title, body);
    return input;
  },
};
