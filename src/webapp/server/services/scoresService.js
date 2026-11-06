const ScoresService = (() => {
  /**
   *
   * @param {string} userId
   * @returns {{ email: string, alternatives: [string], name: string, scores: [{ formTitle: string, formPoints: string, score: number }]}}
   */
  const getByUser = (userId) => {
    Logger.log('Getting scores for %s', userId);
    const userData = {
      email: userId,
      name: '',
      alternatives: [],
      scores: [],
    };

    // Sheet data.
    const formsUrls = ScoresSheet.values.getRow({ rowKey: 'url' });
    const formsTitles = ScoresSheet.values.getRow({ rowKey: 'title' });
    const formsPoints = ScoresSheet.values.getRow({ rowKey: 'points' });

    // Get the respondent row number.
    const respondentRowNum = ScoresSheet.respondents.find(userData.email);
    if (!respondentRowNum) return null;

    // Mask the respondent name.
    const respondentName = (ScoresSheet.values
      .getCell({
        rowNum: respondentRowNum,
        colKey: 'name',
      }) || '')
      .trim();
    const nameParts = respondentName.split(' ');
    if (nameParts.length > 2) {
      userData.name = `${nameParts[0]} ... ${nameParts[nameParts.length - 1].slice(0, 1)}.`;
    } else if (nameParts.length === 2) {
      userData.name = `${nameParts[0]} ${nameParts[1].slice(0, 1)}.`;
    } else {
      userData.name = respondentName;
    }

    // Get the scores.
    const respondentScores = ScoresSheet.values.getRow({
      rowNum: respondentRowNum,
    });

    const altRespondentRows = ScoresSheet.respondents.findAlternatives(
      userData.email,
    );
    const altEmails = new Set([userId]);
    for (const altRowNum of altRespondentRows) {
      const altEmail = ScoresSheet.values.getCell({
        rowNum: altRowNum,
        colKey: 'email',
      });
      Logger.log(
        'Row %s, "%s", is set as an alternative response for this user',
        altRowNum,
        altEmail,
      );
      const rowScores = ScoresSheet.values.getRow({ rowNum: altRowNum });
      rowScores.forEach((v, i) => {
        if (v && !respondentScores[i] && respondentScores[i] !== 0) {
          respondentScores[i] = v;
          altEmails.add(altEmail);
          Logger.log(
            'Used score from alternative response for form "%s"',
            formsTitles[i],
          );
        }
      });
    }
    userData.alternatives = [...altEmails].map((email) =>
      StringUtils.maskEmail(email.toString()),
    );

    // Map the scores.
    const normalizeFormTitle = (title) =>
      StringUtils.toProperCase(
        String(title)
          .split(/\s*[-–—]\s*/)
          .map((str) =>
            str
              .toLowerCase()
              .replace('t4', '')
              .replace('checando a aprendizagem', '')
              .trim(),
          )
          .filter(Boolean)
          .join(' - '),
      );

    userData.scores.push(
      ...respondentScores
        .map((score, i) =>
          Config.data.gForms.excludedUrls.includes(formsUrls[i])
            ? null
            : {
                formTitle: normalizeFormTitle(formsTitles[i]),
                formPoints: formsPoints[i],
                score: score,
              },
        )
        .filter(Boolean),
    );
    userData.scores.sort((a, b) =>
      a.formTitle.localeCompare(b.formTitle, 'pt', { sensitivity: 'base' }),
    );
    Logger.log(
      'Got scores for respondent %s (%s)',
      userData.email,
      userData.alternatives,
    );

    return userData;
  };

  return {
    getByUser,
  };
})();
