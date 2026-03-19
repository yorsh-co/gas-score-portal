/**
 * @typedef {Object} ConfigData
 * @property {{ localeIdentifier: string }} global
 * @property {{
 *   excludedUrls: string,
 *   titleQuery: string,
 *   fullTextQuery: string
 * }} gForms
 * @property {{
 *   parentFolderUrl: string
 * }} gDrive
 * @property {{
 *   authStatus: string
 *   versionNumber: string,
 *   deploymentId: string,
 *   webappUrl: string,
 *   webappTitle: string,
 *   faviconUrl: string,
 *   entryRoute: string
 * }} appsScript
 */

/**
 * @typedef {Object} ConfigObject
 * @property {ConfigData} data
 * @property {() => ConfigData} load
 * @property {() => ConfigData} save
 * @property {(ss?: GoogleAppsScript.Spreadsheet.Spreadsheet) => ConfigData} loadFromSheet
 * @property {(ss?: GoogleAppsScript.Spreadsheet.Spreadsheet) => void} saveToSheet
 * @property {(alertUser?: boolean) => void} checkMissing
 * @property {object} triggers
 * @property {(e: GoogleAppsScript.Events.SheetsOnEdit) => void} triggers.onEdit
 * @property {() => void} triggers.onOpen
 * @property {() => void} triggers.install
 */

/** @type {ConfigObject} */
const Config = (() => {
  const PROPERTY_KEY = 'projectConfig';

  const SHEET = {
    name: '⚙️ Config',
    rows: { first: 1 },
    cols: {
      key: 1,
      resource: 2,
      title: 3,
      value: 4,
      description: 5,
    },
  };

  const schema = {
    global: { localeIdentifier: '' },
    gForms: {
      excludedUrls: '',
      titleQuery: '',
      fullTextQuery: '',
    },
    gDrive: {
      parentFolderUrl: '',
    },
    appsScript: {
      authStatus: '',
      versionNumber: '',
      deploymentId: '',
      webappUrl: '',
      webappTitle: '',
      faviconUrl: '',
      entryRoute: '',
    },
  };

  const protectedFields = {
    appsScript: {
      authStatus: '',
      versionNumber: '',
      deploymentId: '',
      webappUrl: '',
      entryRoute: '',
    },
  };

  /** @type {ConfigData} */
  let data = JSON.parse(JSON.stringify(schema));

  /*
   * STORAGE
   */
  const load = () => {
    const raw =
      PropertiesService.getScriptProperties().getProperty(PROPERTY_KEY);

    if (!raw) return data;

    try {
      Object.assign(data, JSON.parse(raw));
    } catch (err) {
      console.error('Invalid config JSON', err);
    }

    return data;
  };

  const save = () => {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEY,
      JSON.stringify(data),
    );

    saveToSheet();

    return data;
  };

  /*
   * SHEET
   */

  const loadFromSheet = (ss = SS) => {
    const sheet = ss.getSheetByName(SHEET.name);

    if (!sheet) throw new Error('Config sheet not found');

    const rows = sheet.getDataRange().getValues();

    let resource;

    for (let i = SHEET.rows.first - 1; i < rows.length; i++) {
      const key = rows[i][SHEET.cols.key - 1];
      const resourceKey = rows[i][SHEET.cols.resource - 1];
      const value = rows[i][SHEET.cols.value - 1];

      if (resourceKey) resource = data[key];
      else if (resource) resource[key] = value;
    }

    save();

    return data;
  };

  const saveToSheet = (ss = SS) => {
    const sheet = ss.getSheetByName(SHEET.name);

    if (!sheet) throw new Error('Config sheet not found');

    const keys = sheet
      .getRange(1, SHEET.cols.key, sheet.getLastRow(), 1)
      .getValues()
      .map((r) => r[0]);

    Object.entries(data).forEach(([resource, entries]) => {
      const resourceRow = keys.indexOf(resource) + 1;

      if (!resourceRow) return;

      Object.entries(entries).forEach(([k, v]) => {
        const row = keys.indexOf(k, resourceRow) + 1;

        if (row) sheet.getRange(row, SHEET.cols.value).setValue(v);
      });
    });

    protect_();
    SpreadsheetApp.flush();
  };

  const protect_ = (ss = SS) => {
    const sheet = ss.getSheetByName(SHEET.name);

    if (!sheet) throw new Error('Config sheet not found');

    const keys = sheet
      .getRange(1, SHEET.cols.key, sheet.getLastRow(), 1)
      .getValues()
      .map((r) => r[0]);

    Object.entries(protectedFields).forEach(([resource, entries]) => {
      const resourceRow = keys.indexOf(resource) + 1;

      if (!resourceRow) return;

      Object.entries(entries).forEach(([k, v]) => {
        const row = keys.indexOf(k, resourceRow) + 1;

        if (row)
          sheet.getRange(row, SHEET.cols.value).protect().setWarningOnly(true);
      });
    });
    SpreadsheetApp.flush();
  };

  /*
   * VALIDATION
   */

  const getMissing = () => {
    const flatten = (obj, prefix = '') => {
      let out = [];

      for (const k in obj) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof obj[k] === 'object' && obj[k] !== null)
          out = out.concat(flatten(obj[k], key));
        else out.push([key, obj[k]]);
      }
      return out;
    };

    return flatten(data).filter(
      ([k, v]) => v === '' || v === null || v === undefined,
    );
  };

  const checkMissing = (alertUser = false) => {
    const missing = getMissing();
    if (!missing.length) return;

    const message =
      'Configurações faltando: ' + missing.map((m) => m[0]).join(', ');
    console.error(message);

    if (alertUser) SpreadsheetApp.getUi().alert(message);
  };

  /*
   * TRIGGERS
   */

  /**
   * Handles onEdit for the configuration sheet.
   * Pulls the latest configuration from the sheet into the config instance.
   * @param {GoogleAppsScript.Events.SheetsOnEdit} e
   * @param {ProjectConfig} configInstance - Optional config instance (default: global Config)
   */
  const onEdit = (e) => {
    const sheet = e.range.getSheet();

    if (
      sheet.getName() === SHEET.name &&
      e.range.getColumn() === SHEET.cols.value &&
      e.range.getRow() >= SHEET.rows.first
    ) {
      loadFromSheet();
      Toast.success('Configurações salvas');
    }
  };

  /**
   * Handles onOpen for the spreadsheet.
   * Loads the configuration and validates required fields.
   * @param {GoogleAppsScript.Events.SheetsOnOpen} e
   * @param {ProjectConfig} configInstance - Optional config instance (default: global Config)
   */
  const onOpen = () => {
    Toast.loading('Carregando as configurações...');
    loadFromSheet();
    checkMissing();
    Toast.ready('Configurações carregadas');
  };

  /**
   * Installs both the onEdit and onOpen triggers for the configuration sheet.
   * @param {Object} options - Optional parameters
   * @param {string} options.editHandlerName - Name of the onEdit handler function
   * @param {string} options.openHandlerName - Name of the onOpen handler function
   */
  const install = (options = {}) => {
    const editHandler = options.editHandlerName || 'onEditConfig';
    const openHandler = options.openHandlerName || 'onOpenConfig';

    try {
      TriggerUtils.installOnEdit(editHandler);
      TriggerUtils.installOnOpen(openHandler);
      Logger.log('Config triggers installed successfully.');
    } catch (err) {
      Toast.error(
        `Erro na instalação das configurações: ${err.message || err}`,
      );
      throw err;
    }
  };

  /**
   * UI MENU
   */
  const menuSave_ = () => {
    try {
      loadFromSheet();
      Toast.success('Configurações salvas');
    } catch (err) {
      Toast.error(err.message || err);
      throw err;
    }
  };

  // Initialize
  load();

  return {
    data,
    load,
    save,
    loadFromSheet,
    saveToSheet,
    checkMissing,
    triggers: {
      onEdit,
      onOpen,
      install,
    },
    ui: {
      get save() {
        return menuSave_;
      },
    },
  };
})();

/**
 * UI and Triggers
 */
const onEditConfig = (e) => Config.triggers.onEdit(e);
const onOpenConfig = (e) => Config.triggers.onOpen(e);
const menuSaveConfig = () => Config.ui.save();
