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
 * `filters` optionally excludes specific words from a category - e.g.
 * { "c01-letters-3x": ["א", "ב"] } to test every letter except alef and
 * bet. A category's exact text match is excluded everywhere it occurs
 * (e.g. all 3 repetitions of a letter in "Letters (3x)"), which lets a
 * teacher pick exactly which letters/words within a category to test.
 * Categories not present in `filters`, or whose filter would exclude every
 * word, use every word as before (excluding everything isn't a meaningful
 * choice - the checkbox for the whole category exists for that).
 */
function assemble(categoryIds, filters = {}) {
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

  const filtered = selected.map((cat, index) => {
    const categoryNumber = index + 1;
    const excluded = filters[cat.id];
    const kept =
      Array.isArray(excluded) && excluded.length
        ? cat.words.filter((w) => !excluded.includes(w))
        : cat.words;
    const wordList = kept.length > 0 ? kept : cat.words;
    return { categoryNumber, categoryId: cat.id, categoryName: cat.name, wordList };
  });

  const summary = filtered.map((f) => ({
    categoryNumber: f.categoryNumber,
    categoryName: f.categoryName,
    count: f.wordList.length,
  }));

  const words = filtered.flatMap((f) =>
    f.wordList.map((text) => ({ text, categoryNumber: f.categoryNumber }))
  );
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
