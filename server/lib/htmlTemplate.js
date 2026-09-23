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
  <section class="doc-section instructions" dir="ltr">
    <h2 class="section-heading">Teacher Testing Instructions</h2>
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
        <td class="num-cell"><span class="cat-badge cat-badge-general">&ndash;</span></td>
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
  <section class="doc-section results-summary" dir="ltr">
    <h2 class="section-heading">Results Summary</h2>
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
  <section class="doc-section notes-box" dir="ltr">
    <h2 class="section-heading">Notes</h2>
    <div class="notes-lines"><span></span><span></span><span></span></div>
  </section>`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function renderWordCell(word, role, tier) {
  const catBadge =
    role === "teacher"
      ? `<span class="cat-num" title="Category ${word.categoryNumber}">${word.categoryNumber}</span>`
      : "";
  return `
        <div class="cell tier-${tier}">
          ${catBadge}
          <span class="word-text">${escapeHtml(word.text)}</span>
        </div>`;
}

function renderWordGrid(words, role, columns) {
  // One tier for the whole grid (not per-word) so every word - a lone
  // letter included - renders at the same font size; the .cell box itself
  // is already a fixed size everywhere regardless of tier (see css()).
  const tier = sizeTier(words);

  // Teacher and Student share the same continuous grid - no per-category
  // grouping or headings, so a category's word count never leaves a
  // ragged, empty-looking gap before the next category. The Teacher copy
  // still shows which category each word belongs to via the small corner
  // badge renderWordCell() adds per word (see role in that function), and
  // the Results Summary table above still lists every category by name.
  //
  // Numbered by line (not by word) - each row of the grid gets one number,
  // in a narrow column of its own so it lines up with every row.
  const lines = chunk(words, columns)
    .map(
      (lineWords, i) => `
      <div class="grid-line" style="grid-template-columns: 22px repeat(${columns}, 1fr);">
        <span class="line-num">${i + 1}</span>
        ${lineWords.map((w) => renderWordCell(w, role, tier)).join("\n")}
      </div>`
    )
    .join("\n");
  return `
    <section class="word-grid">
      ${lines}
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

  // Student Name gets more grid space than the rest - it's the one field
  // that regularly holds a real (potentially long) value, where the others
  // are either short or left blank for handwriting; a fixed equal split
  // was clipping longer names.
  const columnWidths = fields.map((f, i) => (i === 0 ? "1.8fr" : "1fr")).join(" ");

  return `
  <div class="meta-fields" dir="ltr" style="grid-template-columns: ${columnWidths};">
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
      border-bottom: 1.5pt solid #222;
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
    .doc-header .role-info {
      font-size: 9pt;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .doc-header .role-info .code {
      color: #7a1f2b;
      font-weight: 700;
    }

    .meta-fields {
      direction: ltr;
      text-align: left;
      display: grid;
      gap: 4px 18px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9.5pt;
      border-bottom: 1px solid #999;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .meta-fields .field { display: flex; gap: 5px; align-items: flex-end; min-width: 0; }
    .meta-fields .field-label { color: #444; white-space: nowrap; }
    .meta-fields .field-value {
      min-width: 0;
      flex: 1;
      border-bottom: 1px solid #666;
      padding: 0 4px;
      overflow-wrap: break-word;
    }

    .doc-section {
      direction: ltr;
      text-align: left;
      margin-bottom: 8px;
      font-family: 'Segoe UI', Arial, sans-serif;
      page-break-inside: avoid;
    }
    .section-heading {
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #333;
      border-bottom: 1.25pt solid #333;
      padding-bottom: 2px;
      margin: 0 0 5px;
    }
    .instructions ol {
      margin: 0;
      padding-inline-start: 18px;
      font-size: 8.5pt;
      line-height: 1.35;
    }

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

    .notes-lines { display: flex; flex-direction: column; gap: 12pt; margin-top: 4pt; }
    .notes-lines span { display: block; height: 0; border-bottom: 1px solid #999; }

    .cat-badge {
      font-weight: 700;
      color: #7a1f2b;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
    }
    .cat-badge-general { color: #888; font-weight: 400; }

    .word-grid { }

    .grid-line {
      display: grid;
      gap: 3px;
      margin-bottom: 3px;
    }
    .line-num {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7.5pt;
      color: #999;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .cell {
      container-type: inline-size;
      position: relative;
      border: 1px solid #999;
      border-radius: 3px;
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
    .cell .cat-num {
      position: absolute;
      top: 2px;
      left: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      color: #7a1f2b;
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
  // as plain text in the byline instead, to pair the two back up after
  // handing them out.
  const titleHtml =
    role === "student" && matchCode
      ? `<h1 class="doc-title doc-code">${matchCode}</h1>`
      : `<h1 class="doc-title">${title}</h1>`;
  const roleInfoHtml = `<span class="role-info">${roleLabel}${
    role === "teacher" && matchCode ? ` &middot; Code <span class="code">${matchCode}</span>` : ""
  }</span>`;

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
    ${roleInfoHtml}
  </div>
  ${renderMetaFields(role, meta)}
  ${role === "teacher" ? renderInstructions() : ""}
  ${role === "teacher" ? renderResultsSummary(assembled.summary) : ""}
  ${role === "teacher" ? renderNotesBox() : ""}
  ${renderWordGrid(assembled.words, role, columns)}
</body>
</html>`;
}

module.exports = { buildHtml, escapeHtml, sizeTier, letterCount, GENERAL_SKILLS, chunk };
