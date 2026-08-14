const { getFontFaceCss } = require("./fonts");
const { TEACHER_INSTRUCTIONS } = require("./instructions");

// Hebrew consonant block (includes final forms) - used to size words by
// their visual letter count while ignoring nikud/te'amim combining marks.
const HEBREW_LETTER_RE = /[א-ת]/g;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function letterCount(word) {
  const matches = word.match(HEBREW_LETTER_RE);
  return matches ? matches.length : word.length;
}

function sizeTier(words) {
  const maxLen = Math.max(...words.map((w) => letterCount(w.text)));
  if (maxLen <= 2) return "xl";
  if (maxLen <= 4) return "lg";
  if (maxLen <= 7) return "md";
  return "sm";
}

function renderInstructions() {
  const items = TEACHER_INSTRUCTIONS.map(
    (line, i) => `<li>${escapeHtml(line)}</li>`
  ).join("\n");
  return `
  <section class="instructions" dir="ltr">
    <h2>Teacher Testing Instructions</h2>
    <ol>${items}</ol>
  </section>`;
}

// Always tracked on every assessment, regardless of which specific word-bank
// categories were selected - a place to note letter/vowel mistakes in
// general, in addition to (not instead of) the selected categories below.
const GENERAL_SKILLS = ["Letters", "Vowels"];

function renderResultsSummary(summary) {
  const generalRows = GENERAL_SKILLS.map(
    (name) => `
      <tr>
        <td class="num-cell"><span class="cat-badge cat-badge-general">&bull;</span></td>
        <td class="name-cell">${name}</td>
        <td class="blank-cell">______</td>
      </tr>`
  ).join("\n");

  const categoryRows = summary
    .map(
      (s) => `
      <tr>
        <td class="num-cell"><span class="cat-badge">${s.categoryNumber}</span></td>
        <td class="name-cell">${escapeHtml(s.categoryName)}</td>
        <td class="blank-cell">______ / ${s.count}</td>
      </tr>`
    )
    .join("\n");

  return `
  <section class="results-summary" dir="ltr">
    <h2>Results Summary</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Category</th>
          <th>Read Incorrectly</th>
        </tr>
      </thead>
      <tbody>${generalRows}${categoryRows}</tbody>
    </table>
  </section>`;
}

function renderNotesBox() {
  return `
  <section class="notes-box" dir="ltr">
    <h2>Notes</h2>
    <div class="notes-lines"><span></span><span></span><span></span></div>
  </section>`;
}

function renderWordCell(word, role) {
  // Sized per-word (not per-document/category) so a lone short letter and a
  // long multi-syllable word each get a font-size that fits their own text -
  // the .cell box itself stays a fixed size everywhere (see css()), so
  // "tier" here only ever changes the text, never the card.
  const tier = sizeTier([word]);
  const catBadge =
    role === "teacher"
      ? `<span class="cat-num" title="Category ${word.categoryNumber}">${word.categoryNumber}</span>`
      : "";
  return `
        <div class="cell tier-${tier}">
          <span class="seq-num">${word.rowNumber}</span>
          ${catBadge}
          <span class="word-text">${escapeHtml(word.text)}</span>
        </div>`;
}

function renderWordGrid(words, role, columns) {
  // Teacher and Student share the same continuous grid - no per-category
  // grouping or headings, so a category's word count never leaves a
  // ragged, empty-looking gap before the next category. The Teacher copy
  // still shows which category each word belongs to via the small corner
  // badge renderWordCell() adds per word (see role in that function), and
  // the Results Summary table above still lists every category by name.
  const cells = words.map((w) => renderWordCell(w, role)).join("\n");
  return `
    <section class="word-grid">
      <div class="grid" style="grid-template-columns: repeat(${columns}, 1fr);">
        ${cells}
      </div>
    </section>`;
}

function renderMetaFields(role, meta) {
  const fields = [
    { label: "Student Name", value: meta.studentName ? escapeHtml(meta.studentName) : "" },
    { label: "Grade / Class", value: meta.grade ? escapeHtml(meta.grade) : "" },
  ];
  if (!meta.hideDate) {
    fields.push({ label: "Date", value: meta.date ? escapeHtml(meta.date) : "" });
  }
  if (role === "teacher") {
    fields.push({ label: "Teacher", value: "" });
    fields.push({ label: "Fluency speed", value: "" });
  }

  return `
  <div class="meta-fields" dir="ltr">
    ${fields
      .map(
        (f) => `
      <div class="field">
        <span class="field-label">${f.label}:</span>
        <span class="field-value">${f.value}</span>
      </div>`
      )
      .join("\n")}
  </div>`;
}

function css() {
  return `
    ${getFontFaceCss()}

    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      direction: rtl;
      font-family: 'David Libre', 'Times New Roman', serif;
      color: #1a1a1a;
    }
    body { padding: 0.35in 0.5in; }

    .doc-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 2px solid #222;
      padding-bottom: 4px;
      margin-bottom: 5px;
    }
    .doc-header .bh {
      font-size: 13pt;
      font-weight: 700;
      direction: rtl;
    }
    .doc-header .doc-title {
      font-size: 17pt;
      margin: 0;
      font-weight: 700;
      text-align: center;
      flex: 1;
    }
    .doc-header .doc-title.doc-code {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 21pt;
      letter-spacing: 0.18em;
    }
    .doc-header .header-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .doc-header .role-badge {
      font-size: 10pt;
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #222;
      color: #fff;
      padding: 3px 10px;
      border-radius: 10px;
      white-space: nowrap;
    }
    .doc-header .match-tag {
      font-size: 9pt;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #7a1f2b;
      border: 1px solid #7a1f2b;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }

    .meta-fields {
      direction: ltr;
      text-align: left;
      display: flex;
      flex-wrap: wrap;
      gap: 3px 20px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9.5pt;
      border-bottom: 1px solid #999;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .meta-fields .field { display: flex; gap: 5px; align-items: flex-end; }
    .meta-fields .field-label { color: #444; }
    .meta-fields .field-value {
      min-width: 80px;
      border-bottom: 1px solid #666;
      padding: 0 4px;
    }

    .instructions {
      direction: ltr;
      text-align: left;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 5px 12px 6px;
      margin-bottom: 6px;
      font-family: 'Segoe UI', Arial, sans-serif;
      page-break-inside: avoid;
    }
    .instructions h2, .results-summary h2, .notes-box h2 {
      font-size: 10pt;
      margin: 0 0 3px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .instructions ol {
      margin: 3px 0 0;
      padding-inline-start: 18px;
      font-size: 8.5pt;
      line-height: 1.25;
    }

    .results-summary { direction: ltr; text-align: left; margin-bottom: 6px; page-break-inside: avoid; }
    .results-summary table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
    }
    .results-summary th, .results-summary td {
      border: 1px solid #888;
      padding: 2px 7px;
      text-align: center;
    }
    .results-summary th { background: #eee; }
    .results-summary .num-cell { width: 32px; }
    .results-summary .name-cell { text-align: left; font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; }
    .results-summary .blank-cell { color: #555; width: 120px; }

    .notes-box {
      direction: ltr;
      text-align: left;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 5px 12px 7px;
      margin-bottom: 6px;
      font-family: 'Segoe UI', Arial, sans-serif;
      page-break-inside: avoid;
    }
    .notes-lines { display: flex; flex-direction: column; gap: 11pt; margin-top: 2pt; }
    .notes-lines span { display: block; height: 0; border-bottom: 1px solid #999; }

    .cat-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #7a1f2b;
      color: #fff;
      font-size: 9.5pt;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .cat-badge-general { background: #555; }

    .word-grid { }

    .grid {
      display: grid;
      gap: 3px;
      margin-bottom: 2px;
    }
    .cell {
      container-type: inline-size;
      position: relative;
      border: 1px solid #999;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.9em 4px 2px;
      page-break-inside: avoid;
      /* Fixed card size for every cell, regardless of that word's tier -
         only the text inside (below) scales per word. Grid rows auto-size
         to their tallest cell, so this has to clear the xl tier's own
         content height (its 32pt font-size ceiling plus padding/line
         height) or an xl cell would still grow past it and stretch just
         its row taller than the rest. */
      min-height: 54pt;
    }
    .cell .seq-num {
      position: absolute;
      top: 2px;
      right: 4px;
      font-size: 7pt;
      color: #777;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .cell .cat-num {
      position: absolute;
      top: 2px;
      left: 4px;
      font-size: 7pt;
      color: #fff;
      background: #7a1f2b;
      border-radius: 50%;
      width: 13px;
      height: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .word-text {
      white-space: nowrap;
      line-height: 1.15;
    }

    .cell.tier-xl .word-text { font-size: clamp(16pt, 26cqw, 32pt); }
    .cell.tier-lg .word-text { font-size: clamp(13pt, 20cqw, 25pt); }
    .cell.tier-md .word-text { font-size: clamp(11pt, 15cqw, 19pt); }
    .cell.tier-sm .word-text { font-size: clamp(9.5pt, 11cqw, 15pt); }

    /* Student copy: bigger and bolder than Teacher's, since the student is
       the one actually reading it. The cell box grows to match the larger
       xl-tier ceiling (see the base .cell min-height comment above for how
       that number is derived). */
    .role-student .word-text { font-weight: 700; }
    .role-student .cell { min-height: 60pt; }
    .role-student .cell.tier-xl .word-text { font-size: clamp(18pt, 29cqw, 35pt); }
    .role-student .cell.tier-lg .word-text { font-size: clamp(15pt, 22cqw, 27pt); }
    .role-student .cell.tier-md .word-text { font-size: clamp(12.5pt, 17cqw, 21pt); }
    .role-student .cell.tier-sm .word-text { font-size: clamp(11pt, 12.5cqw, 16.5pt); }

  `;
}

function buildHtml({ role, assembled, meta = {} }) {
  const title = meta.title ? escapeHtml(meta.title) : "Kriah Reading Assessment";
  const columns = Math.min(Math.max(Number(meta.columns) || 3, 2), 8);
  const roleLabel = role === "teacher" ? "Teacher Copy" : "Student Copy";
  const orientation = meta.orientation === "landscape" ? "landscape" : "portrait";
  const matchCode = assembled.matchCode ? escapeHtml(assembled.matchCode) : "";

  // The Student copy shows the pairing code instead of the descriptive
  // title, so a student can't read what's being assessed off their own
  // page - the Teacher copy keeps the real title and shows the same code
  // as a small tag instead, to pair the two back up after handing them out.
  const titleHtml =
    role === "student" && matchCode
      ? `<h1 class="doc-title doc-code">${matchCode}</h1>`
      : `<h1 class="doc-title">${title}</h1>`;
  const matchTagHtml =
    role === "teacher" && matchCode ? `<span class="match-tag">Code ${matchCode}</span>` : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title} - ${roleLabel}</title>
<style>
  @page { size: letter ${orientation}; margin: 0; }
  ${css()}
</style>
</head>
<body class="role-${role}">
  <div class="doc-header">
    <span class="bh">ב"ה</span>
    ${titleHtml}
    <div class="header-right">
      ${matchTagHtml}
      <span class="role-badge">${roleLabel}</span>
    </div>
  </div>
  ${renderMetaFields(role, meta)}
  ${role === "teacher" ? renderInstructions() : ""}
  ${role === "teacher" ? renderResultsSummary(assembled.summary) : ""}
  ${role === "teacher" ? renderNotesBox() : ""}
  ${renderWordGrid(assembled.words, role, columns)}
</body>
</html>`;
}

module.exports = { buildHtml, escapeHtml, sizeTier, letterCount, GENERAL_SKILLS };
