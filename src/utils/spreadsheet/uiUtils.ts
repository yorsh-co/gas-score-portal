/** Options of `GSheetsUiUtils.promptForValue`. */
interface PromptOptions {
  /** Accept an empty answer. */
  acceptBlank?: boolean;
}

const GSheetsUiUtils = {
  /**
   * Asks the user for a value, asking again while a required answer is empty.
   * @param title Prompt title.
   * @param body Prompt text; defaults to a generic request.
   * @param warning Warning appended to the text.
   * @param options Prompt options.
   * @returns The trimmed answer.
   * @throws {GasError} When the user cancels.
   */
  promptForValue(
    title: string,
    body: string,
    warning: string | null | undefined,
    { acceptBlank = false }: PromptOptions = {},
  ): string {
    const ui = SpreadsheetApp.getUi();
    let prompt = body ? body : tr('prompt.default', { title });
    prompt = warning ? `${prompt}\n\n⚠️ ${warning}` : prompt;

    const response = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() !== ui.Button.OK)
      throw createCancelledError();

    const input = response.getResponseText().trim();
    if (!acceptBlank && !input)
      return GSheetsUiUtils.promptForValue(title, body, tr('prompt.notBlank'), {
        acceptBlank,
      });

    return input;
  },
};
