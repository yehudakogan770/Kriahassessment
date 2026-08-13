const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "..", "data", "categories.json");

let cache = null;

function load() {
  if (!cache) {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    cache = JSON.parse(raw);
  }
  return cache;
}

/** Full category list in canonical spreadsheet order (includes word arrays). */
function getCategories() {
  return load().categories;
}

/** Lightweight list for the selection UI (no word arrays). */
function getCategorySummaries() {
  return load().categories.map(({ id, order, name, count }) => ({
    id,
    order,
    name,
    count,
  }));
}

function getDocumentTitle() {
  return load().title;
}

function getCategoryMap() {
  const map = new Map();
  for (const cat of getCategories()) map.set(cat.id, cat);
  return map;
}

module.exports = {
  getCategories,
  getCategorySummaries,
  getCategoryMap,
  getDocumentTitle,
};
