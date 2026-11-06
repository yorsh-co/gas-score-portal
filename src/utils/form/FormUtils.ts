const FormUtils = {
  /**
   * Returns the points an item is worth in a quiz.
   * @param item Form item.
   * @returns The points, or `0` for items that cannot be graded.
   */
  getItemPoints(item: GoogleAppsScript.Forms.Item): number {
    const types = FormApp.ItemType;
    switch (item.getType()) {
      case types.MULTIPLE_CHOICE:
        return item.asMultipleChoiceItem().getPoints();
      case types.CHECKBOX:
        return item.asCheckboxItem().getPoints();
      case types.LIST:
        return item.asListItem().getPoints();
      case types.TEXT:
        return item.asTextItem().getPoints();
      case types.PARAGRAPH_TEXT:
        return item.asParagraphTextItem().getPoints();
      case types.SCALE:
        return item.asScaleItem().getPoints();
      case types.DATE:
        return item.asDateItem().getPoints();
      case types.DATETIME:
        return item.asDateTimeItem().getPoints();
      case types.TIME:
        return item.asTimeItem().getPoints();
      case types.DURATION:
        return item.asDurationItem().getPoints();
      default:
        return 0;
    }
  },
};
