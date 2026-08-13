const fs = require("fs");
const path = require("path");

const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");

const FACES = [
  { file: "DavidLibre-Regular.ttf", weight: 400 },
  { file: "DavidLibre-Medium.ttf", weight: 500 },
  { file: "DavidLibre-Bold.ttf", weight: 700 },
];

let cachedCss = null;

/**
 * David Libre is an OFL Hebrew text font with full nikud (vowel point)
 * support - the combining marks get positioned correctly by the browser's
 * text shaper. We embed it as base64 so the generated HTML is self
 * contained (no filesystem font lookups needed at PDF-render time).
 */
function getFontFaceCss() {
  if (cachedCss) return cachedCss;

  const blocks = FACES.map(({ file, weight }) => {
    const buf = fs.readFileSync(path.join(FONT_DIR, file));
    const base64 = buf.toString("base64");
    return `
@font-face {
  font-family: 'David Libre';
  font-style: normal;
  font-weight: ${weight};
  src: url(data:font/ttf;base64,${base64}) format('truetype');
}`;
  });

  cachedCss = blocks.join("\n");
  return cachedCss;
}

module.exports = { getFontFaceCss };
