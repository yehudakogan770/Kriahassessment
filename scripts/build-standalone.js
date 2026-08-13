#!/usr/bin/env node
/**
 * Builds standalone/kriah-assessment-builder.html: a single self-contained
 * page (no server, no network calls) with the same document logic as the
 * server/ app. It reuses server/lib/{instructions,assemble,htmlTemplate,
 * docxBuilder}.js verbatim (light text transforms swap `require`/
 * `module.exports` for plain scope, and the Word builder's Node Buffer
 * output for a browser Blob) so both surfaces stay in sync with the same
 * tested logic - only the UI chrome (standalone/src/*) is browser-specific.
 *
 * Run: npm run build-standalone
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER_LIB = path.join(ROOT, "server", "lib");
const OUT_PATH = path.join(ROOT, "standalone", "kriah-assessment-builder.html");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

/** Strips `const {...} = require("./local")`/`require("docx")` lines and
 * the trailing `module.exports = ...` line so the file's declarations can
 * be concatenated into one shared script scope. */
function stripNodeWrapper(source) {
  return source
    .split("\n")
    .filter((line) => !/^const\s*\{[^}]*\}\s*=\s*require\(/.test(line.trim()))
    .filter((line) => !/^module\.exports\s*=/.test(line.trim()))
    .join("\n");
}

function buildFontFaceCss() {
  const fontDir = path.join(ROOT, "server", "assets", "fonts");
  const faces = [
    { file: "DavidLibre-Regular.ttf", weight: 400 },
    { file: "DavidLibre-Medium.ttf", weight: 500 },
    { file: "DavidLibre-Bold.ttf", weight: 700 },
  ];
  return faces
    .map(({ file, weight }) => {
      const base64 = fs.readFileSync(path.join(fontDir, file)).toString("base64");
      return `@font-face {\n  font-family: 'David Libre';\n  font-style: normal;\n  font-weight: ${weight};\n  src: url(data:font/ttf;base64,${base64}) format('truetype');\n}`;
    })
    .join("\n");
}

function buildAppScript() {
  const categoriesData = JSON.parse(read("data/categories.json"));

  const instructions = stripNodeWrapper(read("server/lib/instructions.js"));
  const assemble = stripNodeWrapper(read("server/lib/assemble.js"));
  const htmlTemplate = stripNodeWrapper(read("server/lib/htmlTemplate.js"));

  let docxBuilder = read("server/lib/docxBuilder.js");
  docxBuilder = docxBuilder.replace(
    /const\s*\{[^}]*\}\s*=\s*require\("docx"\);/,
    (match) => match.replace('require("docx")', "docx")
  );
  docxBuilder = docxBuilder
    .split("\n")
    .filter((line) => !/^const\s*\{[^}]*\}\s*=\s*require\("\.\//.test(line.trim()))
    .filter((line) => !/^module\.exports\s*=/.test(line.trim()))
    .join("\n")
    .replace("return Packer.toBuffer(doc);", "return Packer.toBlob(doc);");

  const fontFaceCss = buildFontFaceCss();

  return `
"use strict";
const CATEGORIES_DATA = ${JSON.stringify(categoriesData)};
function getCategories() { return CATEGORIES_DATA.categories; }

${instructions}

const FONT_FACE_CSS = ${JSON.stringify(fontFaceCss)};
function getFontFaceCss() { return FONT_FACE_CSS; }

${assemble}

${htmlTemplate}

${docxBuilder}

${read("standalone/src/app.js")}
`;
}

function main() {
  // docx's bundled UTF-8 stream decoder polyfill contains a literal
  // U+FFFD (Unicode replacement) character as a string literal - its own
  // fallback output for malformed byte sequences. Some artifact hosting
  // validators reject any raw occurrence of that character, so swap it
  // for the equivalent JS escape sequence: identical value at runtime,
  // no literal U+FFFD byte in the source text.
  const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);
  const docxLib = read("node_modules/docx/dist/index.iife.js").replace(
    new RegExp(REPLACEMENT_CHAR, "g"),
    "\\uFFFD"
  );
  const styles = read("standalone/src/styles.css");
  const fontFaceCss = buildFontFaceCss();
  const appScript = buildAppScript();

  let html = read("standalone/src/shell.html");
  html = html.replace("__STYLES__", () => styles);
  html = html.replace("__FONT_FACE_CSS__", () => fontFaceCss);
  html = html.replace("__DOCX_LIB__", () => docxLib);
  html = html.replace("__APP_SCRIPT__", () => appScript);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, html, "utf-8");

  const sizeMb = (fs.statSync(OUT_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)} (${sizeMb} MB)`);
}

main();
