const { getCategories } = require("./data");

class InvalidSelectionError extends Error {}

// A short, print-friendly code (avoids 0/O/1/I/L, which are easy to
// misread on a printed page) shown on both the Teacher and Student copy so
// they can be paired back up - e.g. after handing them out and collecting
// them separately. It doubles as the word-shuffle seed (see mulberry32
// below), which is what actually keeps the two copies' word order in sync;
// the visible code is just that same value made human-legible.
const MATCH_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateMatchCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += MATCH_CODE_ALPHABET[Math.floor(Math.random() * MATCH_CODE_ALPHABET.length)];
  }
  return code;
}

/** Deterministic PRNG seeded from a string (mulberry32) - the same seed
 * always produces the same sequence, so Teacher and Student requests (or
 * the same request replayed later) land on identical shuffle order as
 * long as they're given the same match code. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates - uniform random shuffle, in place. `rng` defaults to
 * Math.random (genuinely random); pass a seeded one for reproducible
 * order. */
function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Shuffles `items` (objects with a `.text`) so that, wherever achievable,
 * no two items with the same `text` land within `minGap` positions of each
 * other - e.g. so the Alef Bet doesn't repeat a letter too soon after its
 * last appearance. Uses the standard "rearrange with a cooldown" greedy
 * strategy: at each position, place whichever still-eligible (not on
 * cooldown) text has the most copies left, so the hardest-to-place values
 * never get stranded with nowhere left to go. Ties are broken with `rng`,
 * and per-text copies are pre-shuffled with it too, so a seeded `rng`
 * still gives a reproducible order.
 *
 * When there aren't enough distinct values to keep everyone `minGap` apart
 * (e.g. only 2-3 distinct letters selected), the constraint is relaxed
 * exactly where needed rather than left unable to make progress - it gets
 * as close to `minGap` as the selection allows.
 */
function spacedShuffle(items, minGap, rng = Math.random) {
  if (items.length <= 1 || minGap <= 0) {
    shuffle(items, rng);
    return;
  }

  const buckets = new Map();
  for (const item of items) {
    if (!buckets.has(item.text)) buckets.set(item.text, []);
    buckets.get(item.text).push(item);
  }
  for (const bucket of buckets.values()) shuffle(bucket, rng);

  const remaining = new Map([...buckets].map(([text, list]) => [text, list.length]));
  const lastUsedAt = new Map();
  const result = [];

  while (result.length < items.length) {
    const idx = result.length;
    const candidates = [...remaining.entries()].filter(([, count]) => count > 0);
    let eligible = candidates.filter(
      ([text]) => !lastUsedAt.has(text) || idx - lastUsedAt.get(text) > minGap
    );
    // Nothing satisfies the gap here - too few distinct values remain for
    // the stretch left. Relax it for just this pick rather than stalling.
    if (eligible.length === 0) eligible = candidates;

    const maxCount = Math.max(...eligible.map(([, count]) => count));
    const tied = eligible.filter(([, count]) => count === maxCount);
    const [text] = tied[Math.floor(rng() * tied.length)];

    result.push(buckets.get(text).pop());
    remaining.set(text, remaining.get(text) - 1);
    lastUsedAt.set(text, idx);
  }

  for (let i = 0; i < items.length; i++) items[i] = result[i];
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
 * `filters` optionally narrows down a category's words two ways, which
 * can be combined - e.g. { "c01-letters-3x": { include: ["א", "ב"], limit: 10 } }:
 *   - `include`: specific words/letters to use, and nothing else (every
 *     occurrence of each - e.g. all 3 repetitions of a letter in
 *     "Letters (3x)") - for picking exactly which ones to test. Leaving
 *     it empty (nothing picked) means no restriction - every word.
 *   - `limit`: caps how many words to use (the first N, in spreadsheet
 *     order, after the include filter) when a teacher just wants fewer
 *     words and doesn't care which ones - the original, simpler way to
 *     narrow a category down, kept alongside the newer per-word picker.
 * Categories not present in `filters`, or with an empty `include`, use
 * every word as before.
 *
 * `matchCode`, if given, seeds the shuffle so a Student copy generated
 * from a separate call with the same code lands on the exact same word
 * order as the Teacher copy - see generateMatchCode() above. Omit it to
 * get a fresh random code back on `result.matchCode` (and a genuinely
 * random shuffle), for one-off calls that don't need to be paired with
 * another.
 */
function assemble(categoryIds, filters = {}, matchCode) {
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
    const f = filters[cat.id] || {};
    const include = Array.isArray(f.include) ? f.include : [];
    const kept = include.length ? cat.words.filter((w) => include.includes(w)) : cat.words;
    let wordList = kept.length > 0 ? kept : cat.words;
    if (Number.isInteger(f.limit) && f.limit > 0 && f.limit < wordList.length) {
      wordList = wordList.slice(0, f.limit);
    }
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
  const code = matchCode || generateMatchCode();
  // minGap 8: e.g. keeps the Alef Bet from repeating the same letter again
  // within its next 8 slots. Harmless for categories with no repeated
  // words - with every text distinct, this is just a uniform shuffle.
  spacedShuffle(words, 8, mulberry32(hashSeed(code)));
  words.forEach((w, i) => {
    w.rowNumber = i + 1;
  });

  return {
    words,
    summary,
    totalWords: words.length,
    totalCategories: summary.length,
    matchCode: code,
  };
}

module.exports = { assemble, InvalidSelectionError, generateMatchCode };
