// Pure spreadsheet -> word-bank conversion, shared by scripts/convert-xlsx-to-json.js
// (Node, via XLSX.readFile) and the standalone app's in-browser import feature
// (via XLSX.read on an uploaded file) - both hand this module already-parsed
// sheet rows, so it has no filesystem/Node dependency itself.
//
// Spreadsheet shape:
//   Row 1: title / notes (ignored)
//   Row 2: category headers, one per column
//   Row 3+: words belonging to that column's category (top to bottom, blanks skipped)

const HEADER_ROW_INDEX = 1; // 0-based -> spreadsheet row 2
const FIRST_DATA_ROW_INDEX = 2; // 0-based -> spreadsheet row 3

function slugify(text, fallbackIndex) {
  const ascii = text
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, " ") // drop non-ASCII (e.g. embedded Hebrew) from the slug
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = ascii || `category-${fallbackIndex}`;
  return `c${String(fallbackIndex).padStart(2, "0")}-${base}`;
}

function cleanHeader(raw) {
  return String(raw).replace(/\s+/g, " ").trim();
}

/**
 * @param {Array<Array<unknown>>} rows - sheet_to_json(sheet, {header:1, defval:null}) output
 * @param {{title?: string, sourceSheet?: string}} [meta]
 */
function rowsToCategories(rows, meta = {}) {
  const headerRow = rows[HEADER_ROW_INDEX] || [];
  const dataRows = rows.slice(FIRST_DATA_ROW_INDEX);

  const categories = [];
  let order = 0;

  headerRow.forEach((rawHeader, colIndex) => {
    if (rawHeader === null || rawHeader === undefined) return;
    const name = cleanHeader(rawHeader);
    if (!name) return;

    const words = [];
    for (const row of dataRows) {
      const value = row[colIndex];
      if (value === null || value === undefined) continue;
      const word = String(value).trim();
      if (word) words.push(word);
    }

    if (words.length === 0) return; // skip categories with no words entered

    order += 1;
    categories.push({
      id: slugify(name, order),
      order,
      name,
      count: words.length,
      words,
    });
  });

  return {
    title: meta.title || "Ganeinu Academy - Kriah Reading Assessment",
    sourceSheet: meta.sourceSheet,
    generatedAt: new Date().toISOString(),
    categoryCount: categories.length,
    categories,
  };
}

module.exports = { rowsToCategories, slugify, cleanHeader };
