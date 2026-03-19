const doGet = (e) => {
  App.init();
  return App.handle(e, 'GET');
};

const doPost = (e) => {
  App.init();
  return App.handle(e, 'POST');
};
