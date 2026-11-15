/**
 * Web app GET entry point. Serves the single-page UI when the request names
 * no route; every other request goes to the router.
 * @param e Request event.
 */
function doGet(e: GoogleAppsScript.Events.DoGet) {
  if (e?.parameter?.route) return getApp_().doGet(e);

  const config = getConfig_();
  const output = HtmlService.createHtmlOutput(_PORTAL_HTML)
    .setTitle(config.get('portalTitle') ?? 'Score Portal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  const faviconUrl = config.get('faviconUrl');
  if (faviconUrl) output.setFaviconUrl(faviconUrl);
  return output;
}

/**
 * Web app POST entry point.
 * @param e Request event.
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
  return getApp_().doPost(e);
}
