const SS = SpreadsheetApp.getActiveSpreadsheet();

const SHEETS = {
  forms: {
    name: '🟪 Forms',
    rows: {
      headers: 2,
      first: 3,
    },
    cols: {
      first: 1,
      url: 1,
      title: 2,
      status: 3,
      timestamp: 4,
      last: 4,
    },
  },
  scores: {
    name: '💯 Notas',
    rows: {
      url: 1,
      timestamp: 2,
      points: 3,
      title: 4,
      first: 5,
    },
    cols: {
      email: 1,
      name: 2,
      alternatives: 3,
      first: 4,
    },
  },
  templates: [
    'TEMPLATE 📌 Instruções',
    'TEMPLATE 🟪 Forms',
    'TEMPLATE 💯 Notas',
  ]
};
