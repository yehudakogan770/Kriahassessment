# Kriah Reading Assessment Generator

A website for building Hebrew reading (kriah) assessment sheets from the
Ganeinu Academy word bank. Pick which skill categories to test, and generate
matching **Teacher** and **Student** documents as PDF or Word.

## What it does

- The word bank (28 categories - letters, nekudot, sheva rules, silent
  letters, dagesh confusions, etc.) is loaded from `data/categories.json`,
  generated from the source spreadsheet in `data/source/`.
- Pick any subset of categories in the web UI; a live preview updates as you
  select.
- Generate two matching documents per run:
  - **Student copy**: a numbered grid of the selected words, nothing else.
  - **Teacher copy**: the same grid plus the testing instructions, a
    Results Summary table (mistakes/speed per category), and a small
    reference number next to every word showing which category it belongs
    to. All words in the same category share one number (e.g. every word
    from category 3 is marked "3") - it's a shared category tag, not a
    per-word ID. This reference number only appears on the teacher copy.
- Every word also gets a plain sequential number (1, 2, 3, ...) that runs
  across the whole sheet, on both copies, so the teacher and student can
  follow along together.
- Each format is available as a PDF (nikud rendered via an embedded Hebrew
  font, so it looks the same everywhere) or a Word document (editable, uses
  the system's "David" font for Hebrew text).

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Updating the word bank

The word list lives in `data/categories.json`, generated from the source
spreadsheet. To change the words, edit the spreadsheet under
`data/source/`, then regenerate:

```bash
npm run convert-data
```

The converter reads row 2 as category headers and every following row as
that category's words (blank cells are skipped), preserving column order -
that order is what determines the category reference numbers a teacher sees
in the UI and on the generated sheets.

## How it's built

- `server/` - Express app.
  - `lib/assemble.js` - turns a set of selected category ids into the
    numbered word list both document builders render from.
  - `lib/htmlTemplate.js` + `lib/fonts.js` - the shared RTL HTML/CSS used
    both for the live preview and as the input to the PDF renderer. Hebrew
    text uses the embedded David Libre font (SIL OFL) so nikud renders
    correctly regardless of what's installed on the viewer's machine.
  - `lib/pdfBuilder.js` - renders that HTML to PDF with a headless Chromium
    (via `puppeteer`).
  - `lib/docxBuilder.js` - builds the Word document natively with the
    `docx` library (RTL tables/paragraphs, same content structure).
  - `routes/` - `GET /api/categories`, `POST /api/preview` (returns HTML),
    `POST /api/generate` (returns the PDF/docx file).
- `public/` - static frontend (vanilla HTML/CSS/JS): category picker with
  live-assigned category numbers, format toggle, and the live preview pane.
- `scripts/convert-xlsx-to-json.js` - regenerates `data/categories.json`
  from the source spreadsheet.

## Notes on fonts

- The **PDF** embeds "David Libre", an open-source Hebrew font built for
  nikud, so vowel points render correctly for every reader without any
  font installed locally.
- The **Word** document references the font "David" (the classic Windows
  Hebrew nikud font) by name rather than embedding it, since Word doesn't
  support font embedding the way this generator produces documents. If a
  computer opening the file doesn't have a Hebrew nikud font installed,
  Word will substitute a fallback; select all and change the font to any
  Hebrew font that supports nikud (David, Times New Roman, Noto Serif
  Hebrew, ...) if that happens.
