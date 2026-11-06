const FormUtils = {
  /**
   *
   * @param {GoogleAppsScript.Forms.Item} item
   * @returns {GoogleAppsScript.Forms.TextItem}
   */
  getItemAsType(item) {
    switch (item.getType()) {
      case FormApp.ItemType.MULTIPLE_CHOICE: {
        return item.asMultipleChoiceItem();
      }
      case FormApp.ItemType.CHECKBOX: {
        return item.asCheckboxItem();
      }
      case FormApp.ItemType.LIST: {
        return item.asListItem();
      }
      case FormApp.ItemType.TEXT: {
        return item.asTextItem();
      }
      case FormApp.ItemType.PARAGRAPH_TEXT: {
        return item.asParagraphTextItem();
      }
      case FormApp.ItemType.SCALE: {
        return item.asScaleItem();
      }
      case FormApp.ItemType.GRID: {
        return item.asGridItem();
      }
      case FormApp.ItemType.CHECKBOX_GRID: {
        return item.asCheckboxGridItem();
      }
      case FormApp.ItemType.RATING: {
        return item.asRatingItem();
      }
      case FormApp.ItemType.DATE: {
        return item.asDateItem();
      }
      case FormApp.ItemType.DATETIME: {
        return item.asDateTimeItem();
      }
      case FormApp.ItemType.TIME: {
        return item.asTimeItem();
      }
      case FormApp.ItemType.DURATION: {
        return item.asDurationItem();
      }
      case FormApp.ItemType.IMAGE: {
        return item.asImageItem();
      }
      case FormApp.ItemType.VIDEO: {
        return item.asVideoItem();
      }
      case FormApp.ItemType.PAGE_BREAK: {
        return item.asPageBreakItem();
      }
      case FormApp.ItemType.SECTION_HEADER: {
        return item.asSectionHeaderItem();
      }
    }
  },
};
