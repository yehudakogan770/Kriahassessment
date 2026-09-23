const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  VerticalAlign,
  Header,
  Footer,
  PageNumber,
  PageOrientation,
  HeightRule,
  convertInchesToTwip,
} = require("docx");
const { sizeTier, GENERAL_SKILLS, chunk } = require("./htmlTemplate");
const { TEACHER_INSTRUCTIONS } = require("./instructions");

const FONT = "David";
const UI_FONT = "Segoe UI";
const ACCENT = "7A1F2B";
const GRAY = "555555";

const MARGIN_IN = 0.6;
const PAGE_SIZE_IN = { portrait: [8.5, 11], landscape: [11, 8.5] };

function usableWidthTwip(orientation) {
  const [widthIn] = PAGE_SIZE_IN[orientation];
  return convertInchesToTwip(widthIn - MARGIN_IN * 2);
}

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_TABLE_BORDERS = {
  top: NONE_BORDER,
  bottom: NONE_BORDER,
  left: NONE_BORDER,
  right: NONE_BORDER,
  insideHorizontal: NONE_BORDER,
  insideVertical: NONE_BORDER,
};
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const GRID_CELL_BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
};
const RULE_BORDER = { style: BorderStyle.SINGLE, size: 8, color: "333333" };

// Base half-point (docx `size` unit) font sizes per word-length tier, tuned
// for a 3-column grid; scaledTierSize() adjusts for the actual column count.
const TIER_BASE_SIZE = { xl: 56, lg: 44, md: 34, sm: 26 };

function scaledTierSize(tier, columns) {
  const scale = Math.min(1.25, Math.max(0.7, 3 / columns));
  const raw = TIER_BASE_SIZE[tier] * scale;
  return Math.max(16, Math.round(raw / 2) * 2);
}

function titleBlock(title, roleLabel, role, matchCode) {
  // The Student copy shows the pairing code instead of the descriptive
  // title (so a student can't read what's being assessed off their own
  // page); the Teacher copy keeps the real title and gets the same code
  // appended to the byline instead, to pair the two back up later.
  const headingText = role === "student" && matchCode ? matchCode : title;
  const bylineRuns = [
    new TextRun({ text: 'ב"ה', font: FONT, size: 20, color: GRAY }),
    new TextRun({ text: "   •   ", size: 18, color: GRAY, font: UI_FONT }),
    new TextRun({ text: roleLabel, italics: true, size: 18, color: GRAY, font: UI_FONT }),
  ];
  if (role === "teacher" && matchCode) {
    bylineRuns.push(
      new TextRun({ text: "   •   ", size: 18, color: GRAY, font: UI_FONT }),
      new TextRun({ text: `Code ${matchCode}`, bold: true, size: 18, color: ACCENT, font: UI_FONT })
    );
  }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: headingText,
          bold: true,
          size: role === "student" && matchCode ? 30 : 34,
          font: role === "student" && matchCode ? UI_FONT : FONT,
          characterSpacing: role === "student" && matchCode ? 40 : undefined,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: bylineRuns,
    }),
  ];
}

function metaFieldsTable(role, meta, usableWidth) {
  const fields = [
    { label: "Student Name", value: meta.studentName || "" },
    { label: "Grade / Class", value: meta.grade || "" },
  ];
  if (!meta.hideDate) {
    fields.push({ label: "Date", value: meta.date || "" });
  }
  if (role === "teacher") {
    fields.push({ label: "Teacher", value: "" });
    fields.push({ label: "Fluency speed", value: "" });
  }

  // Student Name gets more table space than the rest, matching
  // htmlTemplate.js's meta-fields grid - it's the one field that regularly
  // holds a real (potentially long) value, where the others are short or
  // left blank for handwriting.
  const weights = fields.map((f, i) => (i === 0 ? 1.8 : 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const cells = fields.map(
    (f, i) => {
      const cellWidth = Math.floor((usableWidth * weights[i]) / totalWeight);
      return new TableCell({
        width: { size: cellWidth, type: WidthType.DXA },
        borders: { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER },
        children: [
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `${f.label}: `, size: 18, color: "444444", font: UI_FONT }),
              new TextRun({
                text: f.value ? f.value : "      ",
                size: 18,
                font: UI_FONT,
                underline: f.value ? undefined : {},
              }),
            ],
          }),
        ],
      });
    }
  );

  return new Table({
    width: { size: usableWidth, type: WidthType.DXA },
    visuallyRightToLeft: true,
    borders: NO_TABLE_BORDERS,
    rows: [new TableRow({ children: cells })],
  });
}

/** A section label with a plain rule underneath - matches htmlTemplate.js's
 * .section-heading (uppercase, letter-spaced, bottom rule) instead of the
 * boxed-card look, so Instructions/Results Summary/Notes read as normal
 * document sections rather than stacked UI cards. */
function sectionHeading(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    border: { bottom: RULE_BORDER },
    spacing: { before: 100, after: 40 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 20, font: UI_FONT, characterSpacing: 10 }),
    ],
  });
}

function instructionsBlock() {
  const heading = sectionHeading("Teacher Testing Instructions");

  const items = TEACHER_INSTRUCTIONS.map(
    (line, i) =>
      new Paragraph({
        alignment: AlignmentType.LEFT,
        indent: { left: 100 },
        spacing: { after: i === TEACHER_INSTRUCTIONS.length - 1 ? 100 : 20 },
        children: [new TextRun({ text: `${i + 1}. ${line}`, size: 16, font: UI_FONT })],
      })
  );

  return [heading, ...items];
}

function resultsSummaryTable(summary, usableWidth) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ["#", "Category", "Read Incorrectly"].map(
      (text) =>
        new TableCell({
          shading: { fill: "EEEEEE" },
          borders: GRID_CELL_BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, bold: true, size: 16, font: UI_FONT })],
            }),
          ],
        })
    ),
  });

  const cell = (text, opts = {}) =>
    new TableCell({
      borders: GRID_CELL_BORDERS,
      verticalAlign: VerticalAlign.CENTER,
      shading: opts.shading ? { fill: opts.shading } : undefined,
      children: [
        new Paragraph({
          alignment: opts.align || AlignmentType.CENTER,
          children: [new TextRun({ text: String(text), size: 16, font: opts.font || UI_FONT, bold: !!opts.bold, color: opts.color })],
        }),
      ],
    });

  const generalRows = GENERAL_SKILLS.map(
    (name) =>
      new TableRow({
        children: [
          cell("–", { color: GRAY }),
          cell(name, { font: UI_FONT, bold: true, align: AlignmentType.LEFT }),
          cell("______"),
        ],
      })
  );

  const categoryRows = summary.map(
    (s) =>
      new TableRow({
        children: [
          cell(s.categoryNumber, { color: ACCENT, bold: true }),
          cell(s.categoryName, { font: UI_FONT, bold: true, align: AlignmentType.LEFT }),
          cell(`______ / ${s.count}`),
        ],
      })
  );

  const heading = sectionHeading("Results Summary");

  const table = new Table({
    width: { size: usableWidth, type: WidthType.DXA },
    columnWidths: [
      Math.floor(usableWidth * 0.1),
      Math.floor(usableWidth * 0.65),
      Math.floor(usableWidth * 0.25),
    ],
    rows: [headerRow, ...generalRows, ...categoryRows],
  });

  return [heading, table];
}

function notesBoxBlock() {
  const heading = sectionHeading("Notes");

  const lineBorder = { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" } };
  const lines = [0, 1, 2].map(
    () =>
      new Paragraph({
        border: lineBorder,
        spacing: { after: 220 },
        children: [new TextRun({ text: " ", size: 16, font: UI_FONT })],
      })
  );

  return [heading, ...lines];
}

// Student copy: bigger and bolder than Teacher's, since the student is the
// one actually reading it.
const STUDENT_SIZE_SCALE = 1.12;

function wordCell(word, role, columns, cellWidth, tier) {
  const isStudent = role === "student";
  let wordSize = scaledTierSize(tier, columns);
  if (isStudent) wordSize = Math.max(16, Math.round((wordSize * STUDENT_SIZE_SCALE) / 2) * 2);

  const wordRunChildren = [new TextRun({ text: word.text, size: wordSize, font: FONT, bold: isStudent })];
  if (role === "teacher") {
    wordRunChildren.push(
      new TextRun({
        text: " " + String(word.categoryNumber),
        superScript: true,
        bold: true,
        color: ACCENT,
        size: Math.max(16, Math.round(wordSize * 0.4)),
        font: UI_FONT,
      })
    );
  }

  return new TableCell({
    width: { size: cellWidth, type: WidthType.DXA },
    borders: GRID_CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 20, bottom: 30, left: 60, right: 60 },
    children: [
      new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: wordRunChildren }),
    ],
  });
}

function lineNumberCell(number, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: NO_TABLE_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(number), size: 15, color: GRAY, font: UI_FONT })],
      }),
    ],
  });
}

function emptyCell(cellWidth) {
  return new TableCell({
    width: { size: cellWidth, type: WidthType.DXA },
    borders: GRID_CELL_BORDERS,
    children: [new Paragraph({ children: [] })],
  });
}

// Line-number column width - narrow, just enough for a 1-2 digit number.
const LINE_NUM_WIDTH_DXA = 380;

function wordGridBlocks(words, role, columns, usableWidth) {
  // One tier for the whole grid (not per-word) so every word - a lone
  // letter included - renders at the same font size; row height (below)
  // is already fixed everywhere regardless of tier.
  const tier = sizeTier(words);

  // Teacher and Student share the same continuous table - no per-category
  // headings, so a category's word count never leaves a ragged row of
  // empty bordered cells before the next category. The Teacher copy still
  // shows which category each word belongs to via the small superscript
  // number wordCell() adds per word (see role in that function), and the
  // Results Summary table above still lists every category by name.
  //
  // Numbered by line (not by word) - a narrow first column holds one
  // number per row instead of a number in every cell.
  const cellWidth = Math.floor((usableWidth - LINE_NUM_WIDTH_DXA) / columns);
  // Fixed minimum row height so every card is the same size regardless of
  // which word (and therefore which tier) lands in it - generous enough to
  // fit the largest tier's text at the smallest allowed column count (2).
  // The Student copy's text runs bigger (see STUDENT_SIZE_SCALE), so its
  // rows need proportionally more room.
  const rowHeight = { value: role === "student" ? 1250 : 1100, rule: HeightRule.ATLEAST };
  const rows = chunk(words, columns).map((rowWords, i) => {
    const cells = rowWords.map((w) => wordCell(w, role, columns, cellWidth, tier));
    while (cells.length < columns) cells.push(emptyCell(cellWidth));
    return new TableRow({
      cantSplit: true,
      height: rowHeight,
      children: [lineNumberCell(i + 1, LINE_NUM_WIDTH_DXA), ...cells],
    });
  });

  const blocks = [
    new Table({
      width: { size: usableWidth, type: WidthType.DXA },
      visuallyRightToLeft: true,
      columnWidths: [LINE_NUM_WIDTH_DXA, ...Array(columns).fill(cellWidth)],
      rows,
    }),
  ];

  return blocks;
}

function footer(title, roleLabel) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${title} — ${roleLabel}  •  Page `, size: 14, color: GRAY, font: UI_FONT }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: GRAY, font: UI_FONT }),
          new TextRun({ text: " / ", size: 14, color: GRAY, font: UI_FONT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: GRAY, font: UI_FONT }),
        ],
      }),
    ],
  });
}

async function renderDocx({ role, assembled, meta = {} }) {
  const title = meta.title || "Kriah Reading Assessment";
  const columns = Math.min(Math.max(Number(meta.columns) || 3, 2), 8);
  const roleLabel = role === "teacher" ? "Teacher Copy" : "Student Copy";
  const orientation = meta.orientation === "landscape" ? "landscape" : "portrait";
  const usableWidth = usableWidthTwip(orientation);
  const matchCode = assembled.matchCode || "";

  const children = [
    ...titleBlock(title, roleLabel, role, matchCode),
    metaFieldsTable(role, meta, usableWidth),
  ];

  if (role === "teacher") {
    children.push(...instructionsBlock());
    children.push(...resultsSummaryTable(assembled.summary, usableWidth));
    children.push(...notesBoxBlock());
  }

  children.push(...wordGridBlocks(assembled.words, role, columns, usableWidth));

  const doc = new Document({
    title: `${title} - ${roleLabel}`,
    sections: [
      {
        properties: {
          page: {
            // docx swaps width/height itself based on `orientation`, so this
            // size must always be given in portrait terms regardless of the
            // page's actual orientation (see PAGE_SIZE_IN / usableWidthTwip
            // for the already-swapped dimensions used in our own layout math).
            size: {
              width: convertInchesToTwip(PAGE_SIZE_IN.portrait[0]),
              height: convertInchesToTwip(PAGE_SIZE_IN.portrait[1]),
              orientation: orientation === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.6),
              left: convertInchesToTwip(MARGIN_IN),
              right: convertInchesToTwip(MARGIN_IN),
            },
          },
        },
        footers: { default: footer(title, roleLabel) },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { renderDocx };
