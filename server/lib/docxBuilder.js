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
const { sizeTier, GENERAL_SKILLS } = require("./htmlTemplate");
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
const BOX_BORDER = { style: BorderStyle.SINGLE, size: 6, color: "444444" };
const BOX_PARAGRAPH_BORDER = {
  top: BOX_BORDER,
  bottom: BOX_BORDER,
  left: BOX_BORDER,
  right: BOX_BORDER,
};

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

  const cellWidth = Math.floor(usableWidth / fields.length);
  const cells = fields.map(
    (f) =>
      new TableCell({
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
      })
  );

  return new Table({
    width: { size: usableWidth, type: WidthType.DXA },
    visuallyRightToLeft: true,
    borders: NO_TABLE_BORDERS,
    rows: [new TableRow({ children: cells })],
  });
}

function instructionsBlock() {
  const heading = new Paragraph({
    alignment: AlignmentType.LEFT,
    border: BOX_PARAGRAPH_BORDER,
    spacing: { before: 60, after: 30 },
    children: [
      new TextRun({ text: "Teacher Testing Instructions", bold: true, size: 20, font: UI_FONT }),
    ],
  });

  const items = TEACHER_INSTRUCTIONS.map(
    (line, i) =>
      new Paragraph({
        alignment: AlignmentType.LEFT,
        border: BOX_PARAGRAPH_BORDER,
        indent: { left: 200, right: 200 },
        spacing: { after: i === TEACHER_INSTRUCTIONS.length - 1 ? 80 : 0 },
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
          cell("•", { color: GRAY, bold: true, shading: "F2F2F2" }),
          cell(name, { font: UI_FONT, bold: true, align: AlignmentType.LEFT, shading: "F2F2F2" }),
          cell("______", { shading: "F2F2F2" }),
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

  const heading = new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 30 },
    children: [new TextRun({ text: "Results Summary", bold: true, size: 20, font: UI_FONT })],
  });

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
  const heading = new Paragraph({
    alignment: AlignmentType.LEFT,
    border: BOX_PARAGRAPH_BORDER,
    spacing: { before: 60, after: 30 },
    children: [new TextRun({ text: "Notes", bold: true, size: 20, font: UI_FONT })],
  });

  // Same border on every paragraph in the sequence (matching
  // instructionsBlock's pattern) so Word merges them into one continuous
  // box rather than drawing a frame around each line separately. A ruled
  // bottom edge on each blank line gives the teacher somewhere to write.
  const lineBorder = {
    ...BOX_PARAGRAPH_BORDER,
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
  };
  const lines = [0, 1, 2].map(
    (i) =>
      new Paragraph({
        border: i === 2 ? BOX_PARAGRAPH_BORDER : lineBorder,
        indent: { left: 200, right: 200 },
        spacing: { after: 220 },
        children: [new TextRun({ text: " ", size: 16, font: UI_FONT })],
      })
  );

  return [heading, ...lines];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Student copy: bigger and bolder than Teacher's, since the student is the
// one actually reading it.
const STUDENT_SIZE_SCALE = 1.12;

function wordCell(word, role, columns, cellWidth) {
  // Sized per-word (not per-document) so a lone short letter and a long
  // multi-syllable word each get a font-size that fits their own text - the
  // cell's row height (see wordGridBlocks) stays fixed everywhere, so this
  // only ever changes the text, never the card.
  const tier = sizeTier([word]);
  const isStudent = role === "student";
  let wordSize = scaledTierSize(tier, columns);
  if (isStudent) wordSize = Math.max(16, Math.round((wordSize * STUDENT_SIZE_SCALE) / 2) * 2);
  const seqRun = new TextRun({ text: String(word.rowNumber), size: 15, color: "888888", font: UI_FONT });

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
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [seqRun] }),
      new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 0 }, children: wordRunChildren }),
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

function wordGridBlocks(words, role, columns, usableWidth) {
  // Teacher and Student share the same continuous table - no per-category
  // headings, so a category's word count never leaves a ragged row of
  // empty bordered cells before the next category. The Teacher copy still
  // shows which category each word belongs to via the small superscript
  // number wordCell() adds per word (see role in that function), and the
  // Results Summary table above still lists every category by name.
  const cellWidth = Math.floor(usableWidth / columns);
  // Fixed minimum row height so every card is the same size regardless of
  // which word (and therefore which tier) lands in it - generous enough to
  // fit the largest tier's text at the smallest allowed column count (2).
  // The Student copy's text runs bigger (see STUDENT_SIZE_SCALE), so its
  // rows need proportionally more room.
  const rowHeight = { value: role === "student" ? 1250 : 1100, rule: HeightRule.ATLEAST };
  const rows = chunk(words, columns).map((rowWords) => {
    const cells = rowWords.map((w) => wordCell(w, role, columns, cellWidth));
    while (cells.length < columns) cells.push(emptyCell(cellWidth));
    return new TableRow({ cantSplit: true, height: rowHeight, children: cells });
  });

  const blocks = [
    new Table({
      width: { size: usableWidth, type: WidthType.DXA },
      visuallyRightToLeft: true,
      columnWidths: Array(columns).fill(cellWidth),
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
