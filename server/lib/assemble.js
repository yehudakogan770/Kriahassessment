const { getCategories } = require("./data");

class InvalidSelectionError extends Error {}

/** Fisher-Yates - uniform random shuffle, in place. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Turns a set of selected category ids into the numbered word list both
 * document builders (HTML/PDF and docx) render from.
 *
 * Category numbers are assigned 1..K by canonical spreadsheet order (not by
 * the order the caller passed them in), so the same set of categories always
 * numbers the same way no matter how a client happened to list them. Every
 * word carries the category number it belongs to, for the Teacher copy's
 * per-word badge and the Results Summary table - but the words themselves
 * are shuffled into one order across all selected categories (not grouped
 * by category) and numbered 1..N in that shuffled order. Teacher and
 * Student both render from this same `words` list, so word #14 is always
 * the same word on both copies - shuffling once here, rather than
 * separately per role, is what keeps that true.
 *
 * `limits` optionally caps how many words to take from a category (its
 * first N, in spreadsheet order, before shuffling) - e.g.
 * { "c01-letters-3x": 26 } to test fewer than the category's full word
 * count. Categories not present in `limits`, or with a limit at/above the
 * category's full count, use every word as before.
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

  const summary = selected.map((cat, index) => {
    const categoryNumber = index + 1;
    const limit = limits[cat.id];
    const count =
      Number.isInteger(limit) && limit > 0 && limit < cat.words.length
        ? limit
        : cat.words.length;
    return { categoryNumber, categoryId: cat.id, categoryName: cat.name, count };
  });

  const words = selected.flatMap((cat, index) => {
    const categoryNumber = index + 1;
    const limit = limits[cat.id];
    const wordList =
      Number.isInteger(limit) && limit > 0 && limit < cat.words.length
        ? cat.words.slice(0, limit)
        : cat.words;
    return wordList.map((text) => ({ text, categoryNumber }));
  });
  shuffle(words);
  words.forEach((w, i) => {
    w.rowNumber = i + 1;
  });

  return {
    words,
    summary,
    totalWords: words.length,
    totalCategories: summary.length,
  };
}

module.exports = { assemble, InvalidSelectionError };
