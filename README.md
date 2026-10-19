# Kriah Reading Assessment Generator

**Live: https://yehudakogan770.github.io/Kriahassessment/**

A custom domain (`ganeinuacademy.org`, via the `CNAME` file in this repo) is
wired up on the GitHub Pages side, but as of this writing the domain itself
redirects to the school's Instagram page instead of here - the registrar-side
DNS doesn't point at GitHub Pages (yet, or anymore). See "WHERE EVERYTHING
LIVES" in `HANDOFF.md` for the full status and what to check.

A website for building Hebrew reading (kriah) assessment sheets from the
Ganeinu Academy word bank. Pick which skill categories to test, and generate
matching **Teacher** and **Student** documents as PDF or Word.

There are three ways to use it:

- **The live site above** - published straight from this repo via GitHub
  Pages (see `.github/workflows/deploy-pages.yml`); redeploys automatically
  whenever `standalone/kriah-assessment-builder.html` changes on `main`.
- **`standalone/kriah-assessment-builder.html`** - open this file directly in
  a browser (double-click it, or drag it into a browser tab). No install, no
  server, works offline - same page as the live site, just local. PDF export
  opens the browser's print dialog ("Save as PDF"); Word downloads directly.
- **The `server/` app** - `npm install && npm start`, for self-hosting. PDF
  downloads are generated directly (no print dialog) since it renders with a
  real headless Chromium server-side.

Both share the same word bank and the same document logic (layout, numbering,
teacher/student rules) - see "How it's built" below.

## What it does

- The word bank (30 categories - letters, nekudot, sheva rules, silent
  letters, dagesh confusions, etc.) is loaded from `data/categories.json`,
  generated from the source spreadsheet in `data/source/`.
- Pick any subset of categories in the web UI; a live preview updates as you
  select.
- Generate two matching documents per run:
  - **Student copy**: a grid of the selected words, nothing else - no
    numbers or category markings.
  - **Teacher copy**: the same grid plus the testing instructions, a
    Results Summary table (mistakes/speed per category), optional
    Letters/Nekudot "by heart" recitation checklists, and a small
    reference number next to every word showing which category it belongs
    to. All words in the same category share one number (e.g. every word
    from category 3 is marked "3") - it's a shared category tag, not a
    per-word ID. This reference number, and everything else listed above
    it in this bullet, only appears on the teacher copy.
- Every word in a document renders at the same font size, regardless of
  word length.
- Each category can optionally repeat its words a chosen number of times
  (e.g. test the Alef Bet 3x), and can be limited to a chosen number of
  words - both configurable per category in the picker.
- Each format is available as a PDF (nikud rendered via an embedded Hebrew
  font, so it looks the same everywhere) or a Word document (editable, uses
  the system's "David" font for Hebrew text).
- Words per row (2-8) and page orientation (portrait/landscape) are both
  adjustable, to help fit a longer assessment onto one page. The live
  preview shows dashed page-break markers and a running page count so you
  can see how many printed pages a selection will take before generating it.

## Reading Progress tracking (server app only)

**This feature only runs in the `server/` app (`npm start`) - it is NOT part
of the live site or the standalone file**, since it needs a real backend
(teacher accounts + a database) that a static GitHub Pages file can't
provide. If you only ever open the live site or the standalone HTML file,
you will not see this feature at all.

When running `server/`, teachers can sign up/log in (`public/progress.html`)
and log reading-skill assessments for students against a fixed skill
taxonomy (`server/lib/skills.js`: Letters, Phonemic Awareness, Vowels,
Vowel-Letter Blending, Exception Rules, Vowel-Sh'va), recording mastery
level, fluency timing, and optional mistake-pattern notes. A whole-school or
single-class report (`public/progress-report.html`) shows each student's
latest result per skill ("General" view) or their full history ("Detailed"
view), with timing compared against the class/school average for that skill.
Data lives in a local SQLite file at `data/progress.sqlite` (gitignored - not
backed up anywhere unless you back up that file yourself).

## Sign-in, your logo, and a custom word bank

These three are features of the live site / standalone file only (not the
`server/` app):

- **Sign-in.** The site is behind a shared passcode (default: `ganeinu`),
  remembered in the browser after it's entered once. This is a soft
  deterrent, not real security - anyone who reads the page's source can find
  it - it just keeps the link from being casually stumbled into. To set your
  own passcode: edit `AUTH_PASSCODE` near the top of
  `scripts/build-standalone.js`, run `npm run build-standalone`, commit and
  push. Set it to `""` to remove the gate entirely.
- **School logo.** Click "+ Add school logo" in the header (next to the
  title) and pick an image - it replaces the קריאה mark, and the upload
  button disappears once it's set. This is saved in your browser's local
  storage, so it's per-browser/device, not shared with other visitors to the
  live site; whoever manages the site would set it once on the device(s)
  used to generate assessments. Click the logo itself to swap it for a
  different image later.
- **Custom word bank.** Under Word Bank, "Import spreadsheet…" lets you load
  a different `.xlsx` file (same shape as `data/source/`: row 2 is category
  headers, words below). Like the logo, this is saved to your browser only -
  it doesn't change the live site for other visitors. "Reset to default"
  goes back to the built-in Ganeinu word bank. To actually change the site's
  default word bank for everyone, update `data/source/` and run
  `npm run convert-data && npm run build-standalone` instead (see below).

## Running it

Easiest: open `standalone/kriah-assessment-builder.html` in a browser.

To run the server app instead:

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

After changing the word bank, also rebuild the standalone file (see below)
so it picks up the new data:

```bash
npm run build-standalone
```

## How it's built

- `server/lib/` holds the actual document logic, used by both surfaces:
  - `assemble.js` - turns a set of selected category ids into the numbered
    word list both document builders render from.
  - `htmlTemplate.js` + `fonts.js` - the shared RTL HTML/CSS used both for
    the live preview and as the input to the PDF renderer. Hebrew text uses
    the embedded David Libre font (SIL OFL) so nikud renders correctly
    regardless of what's installed on the viewer's machine.
  - `pdfBuilder.js` - renders that HTML to PDF with a headless Chromium
    (via `puppeteer`) - server app only.
  - `docxBuilder.js` - builds the Word document natively with the `docx`
    library (RTL tables/paragraphs, same content structure).
  - `instructions.js` - the verbatim teacher testing instructions.
  - `recitation.js` - Hebrew-alphabetical letter order and teaching-order
    nekudot list, used by the optional "by heart" recitation sections.
- `server/` - the Express app: `routes/categories.js` + `routes/generate.js`
  expose `GET /api/categories`, `POST /api/preview` (returns HTML), and
  `POST /api/generate` (returns the file) - these three mirror what the
  standalone file does client-side. `routes/auth.js` + `routes/progress.js`
  + `lib/db.js` (SQLite via `better-sqlite3`) + `lib/skills.js` are the
  Reading Progress backend (see above) - these have no standalone/client-side
  equivalent, since they need a real server. `public/` is the static
  frontend for all of the above.
- `standalone/` - the single-file browser app.
  - `src/` - its UI chrome (`styles.css`, `app.js`, `shell.html`) - the
    category picker (grouped by word-bank section), live preview, and the
    export actions (PDF via `window.print()` in a hidden iframe so the
    browser's own Hebrew text shaping handles nikud; Word via the `docx`
    package's browser bundle, built to a `Blob` and downloaded directly).
  - `kriah-assessment-builder.html` - the built output; this is what you
    actually open. Regenerate it with `npm run build-standalone`, which
    reads the *same* `server/lib/{instructions,assemble,htmlTemplate,
    docxBuilder}.js` (stripping the `require`/`module.exports` lines so
    they share one script scope) plus the word bank, fonts, and the `docx`
    library, and inlines all of it into one file. This is why both surfaces
    always agree on layout and numbering - there's only one copy of that
    logic, not two hand-kept-in-sync copies.
- `scripts/convert-xlsx-to-json.js` - regenerates `data/categories.json`
  from the source spreadsheet.
- `scripts/build-standalone.js` - builds `standalone/kriah-assessment-builder.html`.

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
