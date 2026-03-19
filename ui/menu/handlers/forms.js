/**
 *
 */
const menuImportDriveForms = () => {
  try {
    Toast.loading();
    new FormsImporter({ allowPrompt: true }).run();
    Toast.success('Forms importados');
  } catch (err) {
    console.error(err);
    Toast.error(err);
    throw new Error(err);
  }
};

/**
 *
 */
const menuLinkNewForm = () => {
  try {
    Toast.loading();
    // Prompt for the form.
    let form;
    let warning;
    while (!form) {
      const inputUrl = GSheetsUiUtils.promptForValue(
        '➕ Adicionar Forms individual',
        'Insira o URL do arquivo Forms a ser vinculado ao sistema.',
        warning,
      );

      form = GForms.forms.get({ url: inputUrl });
      if (!form)
        warning = `Não foi possível acessar o Forms "${inputUrl}". Verifique se você tem permissão para acessar a arquivo.`;
    }

    // Check if it is in the block list
    const formUrl = form.getEditUrl();
    if (String(Config.data.gForms.excludedUrls).includes(formUrl)) {
      const ui = SpreadsheetApp.getUi();
      const selectedButton = ui.alert(
        '➕ Reativar Forms',
        `O Forms "${form.getTitle()}" consta na lista de Forms removidos.\n\n👉 Clique em OK para reativar esse Forms.`,
        ui.ButtonSet.OK_CANCEL,
      );
      if (selectedButton !== ui.Button.OK)
        throw new Error('Cancelado pelo usuário');

      Config.data.gForms.excludedUrls = String(Config.data.gForms.excludedUrls)
        .split(',')
        .map((str) => str.trim())
        .filter((str) => str !== formUrl)
        .join(',');

      Config.save();
    }

    // Insert the form to the sheet.
    const formTitle = form.getTitle();
    Toast.busy(`Vinculando "${formTitle}"...`);
    const linkedForm = new LinkedForm().initializeFromForm(form);
    FormsSheet.insertNewLinkedForms([linkedForm]);
    Toast.success(`"${formTitle}" vinculado`);
  } catch (err) {
    console.error(err);
    Toast.error(err);
    throw new Error(err);
  }
};

/**
 *
 */
const menuRemoveForms = () => {
  try {
    Toast.loading();

    // Get the selected linked forms.
    if (!FormsSheet.isActive())
      throw new Error(
        `Esta ação é possível apenas a partir da aba ${SHEETS.forms.name}`,
      );

    const activeRows = FormsSheet.getActiveFormRows();
    if (!activeRows.length) throw new Error('Nenhum Forms selecionado');

    const linkedForms = activeRows.map((rowNum) =>
      FormsSheet.getLinkedForm({ rowNum }),
    );

    // Prompt for confirmation.
    const ui = SpreadsheetApp.getUi();
    const selectedButton = ui.alert(
      '➖ Remover Forms',
      `Os Forms abaixo serão removidos do sistema e ignorados durante a sincronização das notas:\n\n${linkedForms.map((linkedForm, i) => `${i + 1}. ${linkedForm.title}\n`)}\nPara reativar um desses Forms, utilize o botão "➕ Adicionar Forms individual".\n\n👉 Clique em OK para continuar.`,
      ui.ButtonSet.OK_CANCEL,
    );
    if (selectedButton !== ui.Button.OK)
      throw new Error('Cancelado pelo usuário');

    // Add the URLs to the exclusion list.
    Toast.busy(`Removendo ${linkedForms.length} Forms...`);
    const excludedUrls = new Set(
      Config.data.gForms.excludedUrls
        ? String(Config.data.gForms.excludedUrls)
            .split(',')
            .map((str) => str.trim())
        : [],
    );
    excludedUrls.add(...linkedForms.map((linkedForm) => linkedForm.url));
    Config.data.gForms.excludedUrls = [...excludedUrls].join(',');
    Config.save();

    linkedForms.forEach((linkedForm) =>
      FormsSheet.updateFormStatus(linkedForm, LinkedForm.statusEnum.excluded),
    );

    Toast.success(`Forms removidos`);
  } catch (err) {
    console.error(err);
    Toast.error(err);
    throw new Error(err);
  }
};
