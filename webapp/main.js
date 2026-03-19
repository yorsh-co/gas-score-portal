function doGet(e) {
  App.init();
  return App.handle(e, 'GET');
}

function doPost(e) {
  App.init();
  return App.handle(e, 'POST');
}