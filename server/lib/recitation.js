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
  // A dotted/dagesh variant (e.g. בּ) is taught before its plain counterpart
  // (ב) - confirmed against the reference assessment's own letter order,
  // which lists כּ before כ, תּ before ת, etc. `hasMark` sorts a variant
  // with a second character (any combining mark) ahead of the bare letter.
  const hasMark = word.length > 1 ? 0 : 1;
  const markCode = word.codePointAt(1) || 0;
  return [primary === -1 ? 999 : primary, isFinal, hasMark, markCode];
}

function compareHebrew(a, b) {
  const ka = hebrewSortKey(a);
  const kb = hebrewSortKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a < b ? -1 : a > b ? 1 : 0;
}

const LETTERS_CATEGORY_ID = "c01-letters-3x";
const NEKUDOT_CATEGORY_ID = "c02-nekudot";

// Standard day-school teaching order: the "full" vowels, then the three
// reduced/chataf vowels grouped by their full-vowel counterpart - Kamatz,
// Patach, Tzere, Segol, Sh'va, Cholam, Chirik, Kubutz, Shuruk, then Chataf
// Kamatz/Patach/Segol. Keyed by the nekuda's own combining-mark codepoint
// (not the whole symbol string) since the word bank writes most of these
// as alef+mark but Cholam/Shuruk as vav+mark, and a couple of entries have
// a trailing invisible direction-mark character.
const NEKUDOT_MARK_ORDER = [
  0x05b8, // Kamatz
  0x05b7, // Patach
  0x05b5, // Tzere
  0x05b6, // Segol
  0x05b0, // Sh'va
  0x05b9, // Cholam
  0x05b4, // Chirik
  0x05bb, // Kubutz
  0x05bc, // Shuruk (vav + dagesh - same mark codepoint as a consonant dagesh)
  0x05b3, // Chataf Kamatz
  0x05b2, // Chataf Patach
  0x05b1, // Chataf Segol
];
const DIRECTIONAL_MARK_RE = /[‎‏]/g;

function nekudaMarkCodePoint(symbol) {
  const clean = symbol.replace(DIRECTIONAL_MARK_RE, "");
  return clean.codePointAt(clean.length - 1);
}

function compareNekudot(a, b) {
  const ia = NEKUDOT_MARK_ORDER.indexOf(nekudaMarkCodePoint(a));
  const ib = NEKUDOT_MARK_ORDER.indexOf(nekudaMarkCodePoint(b));
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
}

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
 * The distinct Nekudot symbols, in standard teaching order (deduplicated -
 * the category repeats each one multiple times for the regular word grid,
 * which isn't wanted for a "recite each one once" check).
 */
function getNekudotList() {
  const cat = getCategories().find((c) => c.id === NEKUDOT_CATEGORY_ID);
  if (!cat) return [];
  return [...new Set(cat.words)].sort(compareNekudot);
}

module.exports = { getAlphabetInOrder, getNekudotList };
