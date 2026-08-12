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
  convertInchesToTwip,
} = require("docx");
const { sizeTier } = require("./htmlTemplate");
const { TEACHER_INSTRUCTIONS } = require("./instructions");

const FONT = "David";
const UI_FONT = "Segoe UI";
const ACCENT = "7A1F2B";
const GRAY = "555555";

const MARGIN_IN = 0.6;
const USABLE_WIDTH_TWIP = convertInchesToTwip(8.5 - MARGIN_IN * 2);

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
const TIER_BASE_SIZE = { xl: 64, lg: 52, md: 40, sm: 30 };

function scaledTierSize(tier, columns) {
  const scale = Math.min(1.25, Math.max(0.7, 3 / columns));
  const raw = TIER_BASE_SIZE[tier] * scale;
  return Math.max(16, Math.round(raw / 2) * 2);
}

function titleBlock(title, roleLabel) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 40 },
      children: [new TextRun({ text: title, bold: true, size: 34, font: FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: 'ב"ה', font: FONT, size: 20, color: GRAY }),
        new TextRun({ text: "   •   ", size: 18, color: GRAY, font: UI_FONT }),
        new TextRun({ text: roleLabel, italics: true, size: 18, color: GRAY, font: UI_FONT }),
      ],
    }),
  ];
}

function metaFieldsTable(role, meta) {
  const fields = [
    { label: "Student Name", value: meta.studentName || "" },
    { label: "Date", value: meta.date || "" },
  ];
  if (role === "teacher") {
    fields.push({ label: "Examiner", value: "" });
    fields.push({ label: "Reading Speed / Time", value: "" });
  }

  const cellWidth = Math.floor(USABLE_WIDTH_TWIP / fields.length);
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
    width: { size: USABLE_WIDTH_TWIP, type: WidthType.DXA },
    visuallyRightToLeft: true,
    borders: NO_TABLE_BORDERS,
    rows: [new TableRow({ children: cells })],
  });
}

function instructionsBlock() {
  const heading = new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    border: BOX_PARAGRAPH_BORDER,
    spacing: { before: 120, after: 60 },
    children: [
      new TextRun({ text: "Teacher Testing Instructions", bold: true, size: 22, font: UI_FONT }),
    ],
  });

  const items = TEACHER_INSTRUCTIONS.map(
    (line, i) =>
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        border: BOX_PARAGRAPH_BORDER,
        indent: { left: 200, right: 200 },
        spacing: i === TEACHER_INSTRUCTIONS.length - 1 ? { after: 160 } : undefined,
        children: [new TextRun({ text: `${i + 1}. ${line}`, size: 19, font: UI_FONT })],
      })
  );

  return [heading, ...items];
}

function resultsSummaryTable(summary) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Read Incorrectly", "# Words", "Category", "#"].map(
      (text) =>
        new TableCell({
          shading: { fill: "EEEEEE" },
          borders: GRID_CELL_BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, bold: true, size: 18, font: UI_FONT })],
            }),
          ],
        })
    ),
  });

  const rows = summary.map((s) => {
    const cell = (text, opts = {}) =>
      new TableCell({
        borders: GRID_CELL_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(text), size: 18, font: opts.font || UI_FONT, bold: !!opts.bold, color: opts.color })],
          }),
        ],
      });

    return new TableRow({
      children: [
        cell(`______ / ${s.count}`),
        cell(s.count),
        cell(s.categoryName, { font: FONT, bold: true }),
        cell(s.categoryNumber, { color: ACCENT, bold: true }),
      ],
    });
  });

  const heading = new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text: "Results Summary", bold: true, size: 22, font: UI_FONT })],
  });

  const table = new Table({
    width: { size: USABLE_WIDTH_TWIP, type: WidthType.DXA },
    visuallyRightToLeft: true,
    columnWidths: [
      Math.floor(USABLE_WIDTH_TWIP * 0.22),
      Math.floor(USABLE_WIDTH_TWIP * 0.13),
      Math.floor(USABLE_WIDTH_TWIP * 0.5),
      Math.floor(USABLE_WIDTH_TWIP * 0.15),
    ],
    rows: [headerRow, ...rows],
  });

  return [heading, table];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function wordCell(word, role, columns, tier, cellWidth) {
  const wordSize = scaledTierSize(tier, columns);
  const seqRun = new TextRun({ text: String(word.rowNumber), size: 15, color: "888888", font: UI_FONT });

  const wordRunChildren = [new TextRun({ text: word.text, size: wordSize, font: FONT })];
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
    margins: { top: 60, bottom: 100, left: 80, right: 80 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [seqRun] }),
      new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: wordRunChildren }),
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

function wordGridBlocks(groups, role, columns) {
  const cellWidth = Math.floor(USABLE_WIDTH_TWIP / columns);
  const blocks = [];

  for (const group of groups) {
    if (role === "teacher") {
      blocks.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          shading: { fill: "F1E9EA" },
          spacing: { before: 200, after: 80 },
          indent: { left: 100, right: 100 },
          children: [
            new TextRun({ text: String(group.categoryNumber), bold: true, color: ACCENT, size: 20, font: UI_FONT }),
            new TextRun({ text: `  ${group.categoryName}  `, bold: true, size: 20, font: FONT }),
            new TextRun({ text: `(${group.count} words)`, size: 16, color: GRAY, font: UI_FONT }),
          ],
        })
      );
    } else {
      blocks.push(new Paragraph({ spacing: { before: 160 }, children: [] }));
    }

    const tier = sizeTier(group.words);
    const rows = chunk(group.words, columns).map((rowWords) => {
      const cells = rowWords.map((w) => wordCell(w, role, columns, tier, cellWidth));
      while (cells.length < columns) cells.push(emptyCell(cellWidth));
      return new TableRow({ cantSplit: true, children: cells });
    });

    blocks.push(
      new Table({
        width: { size: USABLE_WIDTH_TWIP, type: WidthType.DXA },
        visuallyRightToLeft: true,
        columnWidths: Array(columns).fill(cellWidth),
        rows,
      })
    );
  }

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
  const columns = Math.min(Math.max(Number(meta.columns) || 3, 2), 5);
  const roleLabel = role === "teacher" ? "Teacher / Examiner Copy" : "Student Copy";

  const children = [
    ...titleBlock(title, roleLabel),
    metaFieldsTable(role, meta),
  ];

  if (role === "teacher") {
    children.push(...instructionsBlock());
    children.push(...resultsSummaryTable(assembled.summary));
  }

  children.push(...wordGridBlocks(assembled.groups, role, columns));

  const doc = new Document({
    title: `${title} - ${roleLabel}`,
    sections: [
      {
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
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
