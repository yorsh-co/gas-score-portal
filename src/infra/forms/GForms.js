/**
 *
 */
const GForms = (() => {
  /**
   *
   * @returns {boolean}
   */
  const checkAccess_ = ({ url, id, form }) => {
    return (form || getForm({ url: url, id: id })) != undefined;
  };

  /**
   *
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.id
   * @returns {GoogleAppsScript.Forms.Form}
   */
  const getForm_ = ({ url, id }) => {
    let form;
    try {
      if (url) form = FormApp.openByUrl(url);
      if (id) form = FormApp.openById(id);
    } catch (err) {
      console.error(err);
    }

    if (!form) console.error('Failed to access form', url || id);

    return form;
  };

  /**
   *
   * @param {GoogleAppsScript.Forms.Form} form
   * @param {Date} after
   *
   *
   */
  const getResponsesForForm_ = (form, after = undefined) => {
    const responses = after ? form.getResponses(after) : form.getResponses();
    Logger.log(
      'Got %s responses from form "%s"%s',
      responses.length,
      form.getId(),
      after ? ` after ${after}` : '',
    );
    return responses;
  };

  /**
   *
   * @param {GoogleAppsScript.Forms.Form} form
   * @param {object} options
   * @param {Date} options.after
   * @param {'string'} options.multipleResponsesPerUser - "newest", "oldest", "all", "highest", "lowest", "average"
   *
   * @returns {[{ email: string, name: string, score: number }]}
   */
  const getRespondentsScores_ = (
    form,
    { after = undefined, multipleResponsesPerUser },
  ) => {
    // Get respondent details question items.
    const emailItem = searchItems_(form, 'email')[0];
    const nameItem = searchItems_(form, 'nome')[0];

    // Get the responses.
    const responses = getResponsesForForm_(form, after);

    // Handle duplicate responses by the same user.
    const treatedResponses = new Map();
    switch (multipleResponsesPerUser) {
      case 'oldest': {
        for (const resp of responses) {
          const email = getRespondentEmail_(resp, emailItem);
          const existing = treatedResponses.get(email);
          if (!existing || resp.getTimestamp() < existing.getTimestamp())
            treatedResponses.set(email, resp);
        }
        break;
      }
      case 'newest': {
        for (const resp of responses) {
          const email = getRespondentEmail_(resp, emailItem);
          const existing = treatedResponses.get(email);
          if (!existing || resp.getTimestamp() > existing.getTimestamp())
            treatedResponses.set(email, resp);
        }
        break;
      }
    }

    // Get the respondents scores.
    const respondentsScores = Array.from(treatedResponses.entries()).map(
      ([email, resp]) => ({
        email: email,
        name: StringUtils.toProperCase(getResponseForItem_(resp, nameItem)),
        score: resp
          .getGradableItemResponses()
          .reduce((total, itemResp) => total + itemResp.getScore(), 0),
      }),
    );
    Logger.log(
      'Got scores for %s respondents%s: %s',
      respondentsScores.length,
      after ? ` after ${after}` : '',
      JSON.stringify(respondentsScores),
    );

    return respondentsScores;
  };

  /**
   *
   * @param {GoogleAppsScript.Forms.FormResponse} resp
   * @param {GoogleAppsScript.Forms.Item} item
   *
   * @returns {string}
   */
  const getResponseForItem_ = (resp, item) => {
    const itemResponse = resp.getResponseForItem(item);
    return itemResponse ? itemResponse.getResponse() || '' : '';
  };

  /**
   *
   * @param {GoogleAppsScript.Forms.FormResponse} resp
   * @param {GoogleAppsScript.Forms.Item} emailItem
   *
   * @returns {string}
   */
  const getRespondentEmail_ = (resp, emailItem) => {
    let email = resp.getRespondentEmail();
    if (email) return StringUtils.normalizeEmail(email);

    if (emailItem) {
      const itemResp = resp.getResponseForItem(emailItem);
      if (itemResp) return StringUtils.normalizeEmail(itemResp.getResponse());
    }

    return 'E-mail não fornecido';
  };

  /**
   *
   * @param {GoogleAppsScript.Forms.Form} form
   * @param {string} query
   *
   * @returns {GoogleAppsScript.Forms.Item}
   */
  const searchItems_ = (form, query) => {
    const normalizedQuery = StringUtils.normalize(query).toLowerCase();
    return form
      .getItems()
      .filter((item) =>
        StringUtils.normalize(item.getTitle())
          .toLowerCase()
          .includes(normalizedQuery),
      );
  };

  return {
    forms: {
      get hasAccess() {
        return checkAccess_;
      },
      get get() {
        return getForm_;
      },
    },
    responses: {
      get get() {
        return getResponsesForForm_;
      },
      get getScores() {
        return getRespondentsScores_;
      },
    },
  };
})();
