const { getCategories } = require("./data");

class InvalidSelectionError extends Error {}

/**
 * Turns a set of selected category ids into the numbered structure both
 * document builders (HTML/PDF and docx) render from.
 *
 * Category numbers are assigned 1..K by canonical spreadsheet order (not by
 * the order the caller passed them in), so the same set of categories always
 * numbers the same way no matter how a client happened to list them. Every
 * word in a given category shares that one category number; the row number
 * is a separate sequential count that runs across the whole assembled list.
 *
 * `limits` optionally caps how many words to take from a category (its
 * first N, in spreadsheet order) - e.g. { "c01-letters-3x": 26 } to test
 * fewer than the category's full word count. Categories not present in
 * `limits`, or with a limit at/above the category's full count, use every
 * word as before.
 */
function assemble(categoryIds, limits = {}) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new InvalidSelectionError("Select at least one category.");
  }

  const requested = new Set(categoryIds);
  const allCategories = getCategories();
  const selected = allCategories.filter((cat) => requested.has(cat.id));

  const missing = [...requested].filter(
    (id) => !allCategories.some((cat) => cat.id === id)
  );
  if (missing.length > 0) {
    throw new InvalidSelectionError(`Unknown category id(s): ${missing.join(", ")}`);
  }

  let rowNumber = 0;
  const groups = selected.map((cat, index) => {
    const categoryNumber = index + 1;
    const limit = limits[cat.id];
    const wordList =
      Number.isInteger(limit) && limit > 0 && limit < cat.words.length
        ? cat.words.slice(0, limit)
        : cat.words;
    const words = wordList.map((text) => {
      rowNumber += 1;
      return { rowNumber, text, categoryNumber };
    });
    return {
      categoryNumber,
      categoryId: cat.id,
      categoryName: cat.name,
      count: wordList.length,
      words,
    };
  });

  const summary = groups.map((g) => ({
    categoryNumber: g.categoryNumber,
    categoryName: g.categoryName,
    count: g.count,
  }));

  return {
    groups,
    summary,
    totalWords: rowNumber,
    totalCategories: groups.length,
  };
}

module.exports = { assemble, InvalidSelectionError };
