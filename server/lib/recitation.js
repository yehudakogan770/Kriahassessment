const { getCategories } = require("./data");

// Same Hebrew-alphabetical sort used by the category word-picker (see
// standalone/src/app.js's compareHebrew) - needed here because a
// "by heart, in order" check only means something if the letters are
// actually in alphabet order, not whatever order they appear in the word
// bank's own source data.
const HEBREW_LETTER_ORDER = "אבגדהוזחטיכלמנסעפצקרשת";
const HEBREW_FINAL_TO_REGULAR = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

function hebrewSortKey(word) {
  const first = word[0] || "";
  const base = HEBREW_FINAL_TO_REGULAR[first] || first;
  const primary = HEBREW_LETTER_ORDER.indexOf(base);
  const isFinal = HEBREW_FINAL_TO_REGULAR[first] ? 1 : 0;
  const markCode = word.codePointAt(1) || 0;
  return [primary === -1 ? 999 : primary, isFinal, markCode];
}

function compareHebrew(a, b) {
  const ka = hebrewSortKey(a);
  const kb = hebrewSortKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a < b ? -1 : a > b ? 1 : 0;
}

const LETTERS_CATEGORY_ID = "c01-letters-3x";
const NEKUDOT_CATEGORY_ID = "c02-nekudot";

/**
 * The full Hebrew alphabet (including final forms and dagesh/shin-dot
 * variants), in standard alphabetical order - for a "by heart, in order"
 * recitation check. Derived from the Letters category's own word list
 * (deduplicated) rather than a separately maintained list, so it always
 * matches whatever letters the word bank actually has.
 */
function getAlphabetInOrder() {
  const cat = getCategories().find((c) => c.id === LETTERS_CATEGORY_ID);
  if (!cat) return [];
  return [...new Set(cat.words)].sort(compareHebrew);
}

/**
 * The distinct Nekudot symbols, in the word bank's own order (deduplicated -
 * the category repeats each one multiple times for the regular word grid,
 * which isn't wanted for a "recite each one once" check).
 */
function getNekudotList() {
  const cat = getCategories().find((c) => c.id === NEKUDOT_CATEGORY_ID);
  if (!cat) return [];
  return [...new Set(cat.words)];
}

module.exports = { getAlphabetInOrder, getNekudotList };
