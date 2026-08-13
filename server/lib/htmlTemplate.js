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

function renderResultsSummary(summary) {
  const rows = summary
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
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderWordCell(word, role) {
  const catBadge =
    role === "teacher"
      ? `<span class="cat-num" title="Category ${word.categoryNumber}">${word.categoryNumber}</span>`
      : "";
  return `
        <div class="cell">
          <span class="seq-num">${word.rowNumber}</span>
          ${catBadge}
          <span class="word-text">${escapeHtml(word.text)}</span>
        </div>`;
}

function renderWordGrid(groups, role, columns) {
  const blocks = groups
    .map((group) => {
      const tier = sizeTier(group.words);
      const heading =
        role === "teacher"
          ? `<div class="cat-heading"><span class="cat-badge">${group.categoryNumber}</span> ${escapeHtml(
              group.categoryName
            )} <span class="cat-count">(${group.count} word${group.count === 1 ? "" : "s"})</span></div>`
          : "";
      const cells = group.words.map((w) => renderWordCell(w, role)).join("\n");
      return `
    <div class="cat-block tier-${tier}">
      ${heading}
      <div class="grid" style="grid-template-columns: repeat(${columns}, 1fr);">
        ${cells}
      </div>
    </div>`;
    })
    .join("\n");

  return `<section class="word-grid">${blocks}</section>`;
}

function renderMetaFields(role, meta) {
  const fields = [
    { label: "Student Name", value: meta.studentName ? escapeHtml(meta.studentName) : "" },
    { label: "Date", value: meta.date ? escapeHtml(meta.date) : "" },
  ];
  if (role === "teacher") {
    fields.push({ label: "Examiner", value: "" });
    fields.push({ label: "Reading Speed / Time", value: "" });
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
      padding-bottom: 6px;
      margin-bottom: 8px;
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
    .doc-header .role-badge {
      font-size: 10pt;
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #222;
      color: #fff;
      padding: 3px 10px;
      border-radius: 10px;
      white-space: nowrap;
    }

    .meta-fields {
      direction: ltr;
      text-align: left;
      display: flex;
      flex-wrap: wrap;
      gap: 6px 22px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10.5pt;
      border-bottom: 1px solid #999;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .meta-fields .field { display: flex; gap: 6px; align-items: flex-end; }
    .meta-fields .field-label { color: #444; }
    .meta-fields .field-value {
      min-width: 90px;
      border-bottom: 1px solid #666;
      padding: 0 4px;
    }

    .instructions {
      direction: ltr;
      text-align: left;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 6px 14px 8px;
      margin-bottom: 8px;
      font-family: 'Segoe UI', Arial, sans-serif;
      page-break-inside: avoid;
    }
    .instructions h2, .results-summary h2 {
      font-size: 11.5pt;
      margin: 0 0 4px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .instructions ol {
      margin: 4px 0 0;
      padding-inline-start: 20px;
      font-size: 9.5pt;
      line-height: 1.3;
    }

    .results-summary { direction: ltr; text-align: left; margin-bottom: 8px; page-break-inside: avoid; }
    .results-summary table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
    }
    .results-summary th, .results-summary td {
      border: 1px solid #888;
      padding: 3px 8px;
      text-align: center;
    }
    .results-summary th { background: #eee; }
    .results-summary .num-cell { width: 32px; }
    .results-summary .name-cell { text-align: left; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
    .results-summary .blank-cell { color: #555; width: 120px; }

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

    .word-grid { }
    .cat-block { margin-bottom: 6px; }
    .cat-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      font-weight: 600;
      background: #f1e9ea;
      border-radius: 4px;
      padding: 2px 8px;
      margin-bottom: 3px;
      page-break-after: avoid;
    }
    .cat-heading .cat-count {
      font-weight: 400;
      color: #555;
      font-size: 8.5pt;
    }

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

    .tier-xl .cell { min-height: 40pt; }
    .tier-xl .word-text { font-size: clamp(16pt, 26cqw, 32pt); }
    .tier-lg .cell { min-height: 36pt; }
    .tier-lg .word-text { font-size: clamp(13pt, 20cqw, 25pt); }
    .tier-md .cell { min-height: 32pt; }
    .tier-md .word-text { font-size: clamp(11pt, 15cqw, 19pt); }
    .tier-sm .cell { min-height: 28pt; }
    .tier-sm .word-text { font-size: clamp(9.5pt, 11cqw, 15pt); }

    @media print {
      .cat-block { break-inside: auto; }
    }
  `;
}

function buildHtml({ role, assembled, meta = {} }) {
  const title = meta.title ? escapeHtml(meta.title) : "Kriah Reading Assessment";
  const columns = Math.min(Math.max(Number(meta.columns) || 3, 2), 8);
  const roleLabel = role === "teacher" ? "Teacher / Examiner Copy" : "Student Copy";
  const orientation = meta.orientation === "landscape" ? "landscape" : "portrait";

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
<body>
  <div class="doc-header">
    <span class="bh">ב"ה</span>
    <h1 class="doc-title">${title}</h1>
    <span class="role-badge">${roleLabel}</span>
  </div>
  ${renderMetaFields(role, meta)}
  ${role === "teacher" ? renderInstructions() : ""}
  ${role === "teacher" ? renderResultsSummary(assembled.summary) : ""}
  ${renderWordGrid(assembled.groups, role, columns)}
</body>
</html>`;
}

module.exports = { buildHtml, escapeHtml, sizeTier, letterCount };
