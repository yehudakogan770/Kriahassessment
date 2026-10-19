# HANDOFF.md

Full project history and current status, written so a brand-new Claude
session (or a new developer) can pick this project up with zero prior
context. See `CLAUDE.md` for the shorter "how to work here" rules; this file
is the long-form record of what exists, why, and what's left.

**Written:** 2026-10-19, at the end of the chat that built this entire
project, because the user (rabbikogan@ganeinuacademy.org) was moving to a
new Claude account and that chat's history would not carry over.

---

## 1. What this project is

A Hebrew reading (Kriah) assessment generator built for **Ganeinu Academy**,
a Jewish day school. Teachers pick which reading skills to test (letters,
nekudot/vowels, sheva rules, silent letters, dagesh confusions, etc.) from a
curated Hebrew word bank, and the app generates matching **Teacher** and
**Student** assessment sheets as PDF or Word, ready to print. The goal was
to replace an ad-hoc/manual process (the school had a hand-made reference
assessment document, included in this handoff - see §7) with something
teachers can self-serve in a browser in under a minute.

A second feature, **Reading Progress tracking**, was added later: teacher
accounts, a student roster, and a log of per-skill assessment results with
a class/school comparison report. This only runs in the self-hosted server
app - see §3 and the live-status caveat in §5.

## 2. Everything built, and how it's structured

The repo ships the same document-generation logic **three ways**:

1. **The live static site** - `standalone/kriah-assessment-builder.html`,
   published via GitHub Pages. Open it in a browser, no install. PDF export
   uses the browser's print dialog; Word downloads directly via the `docx`
   library's browser bundle.
2. **The same file, run locally** - identical, just opened from disk
   instead of a URL. Works offline.
3. **The Express server app** (`server/` + `public/`) - `npm start`, for
   self-hosting. Same document generation (PDFs render server-side via
   headless Chromium instead of the print dialog), **plus** the Reading
   Progress feature, which needs a real backend.

All three share one copy of the actual document logic, in `server/lib/`:

- `assemble.js` - turns selected category ids (+ optional per-category
  `limit`/`repeat` filters) into the final word list, shuffled with an
  8-letter minimum-gap constraint (`spacedShuffle`) so the same
  letter/word doesn't repeat too close to itself.
- `htmlTemplate.js` + `fonts.js` - shared RTL HTML/CSS, used for both the
  live preview and as the PDF renderer's input. Embeds the David Libre
  Hebrew font (SIL OFL licensed) so nikud (vowel points) render correctly
  everywhere.
- `pdfBuilder.js` - HTML → PDF via headless Chromium (`puppeteer`) -
  server app only (the standalone app uses the browser's own print-to-PDF
  instead).
- `docxBuilder.js` - builds the Word document natively via the `docx`
  library.
- `instructions.js` - the verbatim teacher testing instructions text.
- `recitation.js` - Hebrew-alphabetical letter ordering (dagesh/marked
  variant sorts before its plain counterpart) and the standard nekudot
  teaching order, both derived from the school's reference document (§7) -
  used by the optional Letters/Nekudot "by heart" recitation checklists.

**How one copy of this logic reaches both a Node server and a static HTML
file:** `scripts/build-standalone.js` reads those `server/lib/*.js` files as
text, strips their `require`/`module.exports` lines, and concatenates them
into one `<script>` scope inside `standalone/kriah-assessment-builder.html`,
along with the word bank JSON, embedded fonts, and the `docx` package's
browser bundle. This is why both surfaces always agree on layout, ordering,
and behavior - but it also means a top-level `const`/`function` name used in
two of those files collides at runtime **only in the bundled build** (hit
and fixed multiple times this project - see `CLAUDE.md`'s landmine note).

**Word bank:** `data/source/Ganeinu_Assessments_for_Kriah_Curriculum.xlsx`
(the school's real curated word list, 30 categories) → `npm run
convert-data` → `data/categories.json` (committed, not gitignored - both
apps read it directly). Category ids are slugified from their names, so
renaming a category in the spreadsheet changes its id everywhere.

**Reading Progress** (`server/` only): `server/lib/db.js` (SQLite via
`better-sqlite3`, local file `data/progress.sqlite`, gitignored),
`server/lib/auth.js` (scrypt password hashing, cookie sessions),
`server/lib/skills.js` (the fixed skill taxonomy teachers assess against),
`server/routes/auth.js` + `server/routes/progress.js`. Frontend:
`public/progress.html` (log in, log assessments) and
`public/progress-report.html` (class/school report, "General" vs.
"Detailed" view). Built across 5 increments (teacher accounts → students +
logging → skill taxonomy/detail fields → fluency timing/comparison → class/
school report views).

**Branding:** every page (all 4 surfaces: `public/index.html`,
`public/progress.html`, `public/progress-report.html`, the standalone app)
shows the Ganeinu Academy logo and name in its header. The logo file was
replaced once already this project (see §8) - current version is the
sunburst/open-book design at `server/assets/branding/ganeinu-academy-
logo.jpg` and `public/ganeinu-academy-logo.jpg` (same file, duplicated
because `public/` is the Express static root and `server/assets/` isn't
web-accessible; the standalone build embeds it as a base64 data URL at
build time). A teacher can also upload a different logo of their own from
the browser (saved to that browser's `localStorage` only, not shared/live
for other visitors) - that's a separate, independent mechanism from the
built-in default.

## 3. Important decisions and why

- **One shared `server/lib/` instead of two hand-kept-in-sync
  implementations.** The standalone app needed to work with zero backend
  (so the school can use it even if nobody's maintaining a server), but
  duplicating the document logic would drift over time. The text-concat
  build step (`build-standalone.js`) was the chosen tradeoff: one real
  source of truth, at the cost of the shared-scope collision landmine.
- **SQLite over a hosted database for Reading Progress.** Simplicity for a
  single-school, likely-single-server deployment; no account/service to
  set up. Tradeoff, now a live concern: it only persists on whatever
  machine runs `node server/index.js`, isn't backed up anywhere, and (as
  far as this handoff can confirm) **has never actually been deployed
  anywhere persistent** - see §5.
- **A soft passcode gate instead of real auth on the standalone app.** The
  standalone app has no backend to check credentials against, so the gate
  is a client-side SHA-256 compare (`AUTH_PASSCODE` in
  `scripts/build-standalone.js`, currently `"ganeinu"`) - explicitly
  documented in the README and in the code as "not real security," just
  enough to keep the public link from being stumbled into. Reading
  Progress's teacher accounts (server app only) **are** real auth
  (scrypt-hashed passwords, server-side sessions).
- **No sequential word numbering.** Originally built with per-word numbers,
  the user asked for per-line numbers instead, then after seeing it live
  asked to remove numbering from the word grid entirely. What remains: a
  teacher-copy-only category reference badge (small number showing which
  category a word belongs to, shared across all words in that category -
  not a per-word id).
- **Uniform font size for every word.** Originally word cells sized
  dynamically per word length; the user asked for one consistent size
  across the whole document instead.
- **Recitation sections are teacher-copy only.** Originally shipped visible
  to both Teacher and Student copies (reasoned at the time that "the
  student needs to see the letters to recite them") - the user explicitly
  corrected this: it's the teacher's oral-recitation checklist, not
  something the student reads off their own page.
- **Full-document reference-format mimicry was scoped but deliberately
  left incomplete.** The user uploaded their real paper-based reference
  assessment (`Teacher_Kriah_assesment_2026.docx`, see §7) and asked for it
  to be mimicked. After clarifying scope (they want both a new alternate
  mode *and* to borrow its visual style into the existing builder), the
  word-source question (which specific curated word lists populate it) was
  explicitly deferred - "ask me later." The visual/structural pieces that
  *could* be extracted independent of that decision shipped already
  (Letters/Nekudot recitation order and sections, compact 2-column
  instructions, G2 rule show/hide). The "new alternate mode" itself was
  never started, correctly, because it's blocked on that deferred
  decision - see §6.
- **Why `main` gets merges immediately, normally.** Established early in
  this project at the user's request: ship each discrete change (commit,
  push, PR, merge, verify deploy) without a separate "should I ship this?"
  round-trip. This is why the commit history is ~27 small, single-purpose
  PRs rather than a few giant ones.
- **Why *this* round of work (the handoff docs + final fixes) is the
  exception** - see §6 and §9: merges to `main` auto-deploy to the live
  site, and the user was about to be unable to supervise/verify that in
  real time, so this batch stayed on a branch instead, per their explicit
  instruction for this task.

## 4. How to run, test, and deploy

```bash
npm install
npm start                 # server app, http://localhost:3000
# or just open standalone/kriah-assessment-builder.html directly - no server needed
```

Updating the word bank:

```bash
# edit data/source/Ganeinu_Assessments_for_Kriah_Curriculum.xlsx, then:
npm run convert-data       # regenerates data/categories.json
npm run build-standalone   # re-embeds it into the standalone file - don't skip this
```

**There is no automated test suite** (`package.json` has no `test` script).
"Testing" on this project means actually running the app and exercising it
- see `CLAUDE.md`'s "No automated tests" section for the exact approach
(real `/api/...` requests against a running server; Puppeteer against the
real HTML with a `pageerror` listener; `unzip` + Python `xml.etree`, never
regex, for `.docx` content checks). LibreOffice/`soffice`/`pandoc`/
`pdftoppm` are not usable in the Claude Code sandbox this project has been
built in - don't rely on them.

**Deploying:** pushing to `main` with changes under
`standalone/kriah-assessment-builder.html` or `CNAME` auto-triggers
`.github/workflows/deploy-pages.yml`, which publishes
`standalone/kriah-assessment-builder.html` (renamed to `index.html`) plus
`CNAME` to GitHub Pages. The server app has no deploy automation - there is
no evidence it has ever been deployed anywhere outside this
development sandbox (see §5).

## 5. WHERE EVERYTHING LIVES

### GitHub repo

- **`yehudakogan770/Kriahassessment`** (public). The only repo involved -
  no submodules, no separate data/deploy repo.
- **`main`** - production/default branch. Pushes here that touch the
  standalone file or `CNAME` auto-deploy to GitHub Pages (see below).
- **`claude/hebrew-reading-assessment-98v0vr`** - the branch essentially
  all of this project's work happened on, PR by PR, squash-merged into
  `main` each time. This handoff's own work (CLAUDE.md, HANDOFF.md,
  handoff-files/, and the fixes in §9) is on this branch **but
  deliberately not merged to `main` yet** - see §9.

### Hosting / live site

- **GitHub Pages**, auto-deployed from `main` by
  `.github/workflows/deploy-pages.yml`. Confirmed live and working:
  **https://yehudakogan770.github.io/Kriahassessment/** (HTTP 200,
  verified by direct request during this handoff).
- **Custom domain `ganeinuacademy.org`:** a `CNAME` file in the repo root
  wires this up on the GitHub Pages side, and the workflow copies it into
  the deploy. **However**, verified by direct HTTP request during this
  handoff: `https://ganeinuacademy.org/` currently returns **HTTP 301,
  redirecting to `https://www.instagram.com/ganeinuacademy`** - it is
  serving GoDaddy domain-forwarding (the response comes from an
  `ec2.internal` host, not from GitHub), not this site. Same result on
  plain HTTP. **This means the custom domain does not currently show this
  app at all** - only the `github.io` URL above actually works. **This is
  flagged UNCONFIRMED / needs your action** - see §6 for exactly what to
  check.
- There is **no other hosting** anywhere for this project. No Vercel,
  Netlify, Render, Railway, Fly, Heroku, or similar config exists in the
  repo (checked: no `vercel.json`, `netlify.toml`, `render.yaml`,
  `Procfile`, `Dockerfile`), and no deploy workflow targets anything but
  GitHub Pages.
- **The Express server app (`server/`), and therefore the entire Reading
  Progress feature, is NOT deployed anywhere live.** It only runs when
  someone executes `node server/index.js` (or `npm start`) on some
  machine. As far as this handoff can determine, that has only ever been
  this Claude Code sandbox, during development/testing - **flagged
  UNCONFIRMED**: if you (the user) have set up hosting for it somewhere
  through a dashboard rather than a committed config file, this handoff
  has no visibility into that - please confirm either way.

### Domain registrar

- **`ganeinuacademy.org`** - per this project's earlier chat history,
  registered/managed at **GoDaddy** (the user asked for "the codes to give
  to GoDaddy" to wire up the custom domain). This handoff does not have
  GoDaddy account access and cannot see or change its DNS/forwarding
  settings directly - **UNCONFIRMED beyond what HTTP showed us** (the
  Instagram-forwarding behavior above). To actually make
  `ganeinuacademy.org` show this site, in GoDaddy's DNS management for the
  domain: remove/disable whatever "Domain Forwarding" is currently
  pointing it at Instagram, and instead add the standard GitHub Pages apex
  records -
  `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
  `185.199.111.153` (GitHub's documented, stable Pages IPs) - then confirm
  the custom domain in the repo's GitHub Pages settings (Settings → Pages)
  shows it as verified. This needs your GoDaddy login; it's not something
  a Claude session can do without it.

### Databases and storage

- **SQLite**, local file, `data/progress.sqlite` (gitignored - never
  committed, not in this repo's history, not backed up anywhere by this
  project). Holds Reading Progress data (teachers, students, assessments,
  sessions) - see §2. Created automatically on first run of the server
  app. **Given the live-deployment gap above, there is currently no real
  production data in it anywhere** - it only exists ephemerally in
  whatever sandbox the server app was last run in during development.
- No other database, and no cloud storage (no Google Drive, S3, Firebase,
  Supabase, etc.) is used anywhere in this project.

### Outside services, APIs, accounts

- **GitHub** - code hosting + GitHub Pages hosting + GitHub Actions (the
  deploy workflow). Account: `yehudakogan770`.
- **GoDaddy** - domain registration for `ganeinuacademy.org` (see above).
  Currently misconfigured/not pointing here - action needed.
- That's it. No payment processor, no email service, no analytics, no
  third-party API of any kind is integrated anywhere in this codebase
  (confirmed by reading `package.json`'s dependencies - all five are
  self-contained libraries: `express`, `better-sqlite3`, `docx`, `xlsx`,
  `puppeteer`, plus `cookie-parser` - none of them are API clients for an
  external service).

### Environment variables

- **`PORT`** (optional, server app only) - which port `node server/index.js`
  listens on. Defaults to `3000`. Not a secret; no "source" account for it,
  it's just a local runtime setting.
- That is the **only** environment variable this project reads anywhere
  (confirmed by grepping the whole codebase for `process.env.`). There is
  no `.env` file, no `.env.example`, nothing else to configure.

### Secrets / credentials

- **None are stored in the repo** (confirmed this handoff: no `.env*`
  files, and a scan for common API-key/secret patterns across all source
  files found nothing except an expected false-positive inside the
  embedded base64 font data). Keep it that way.
- The standalone app's passcode, **`ganeinu`** (see §3), is not a real
  secret - it's plaintext in `scripts/build-standalone.js` (`AUTH_PASSCODE`)
  and intentionally not protected, since it ships to every visitor's
  browser regardless.
- Reading Progress teacher passwords are real credentials, but they're
  teacher-chosen at signup and scrypt-hashed in the database - nothing to
  hand off here beyond the fact that the feature exists.

### Files/folders used by the project that live outside the repo

- None that this handoff could find still accessible, **except** the
  files now collected into `handoff-files/` (see §7) - those were either
  the user's own uploads during the original chat (not committed anywhere
  until now) or deliverables generated during that chat and shown to the
  user but never saved into the repo. Everything else referenced by the
  app (word bank, fonts, logo, instructions) is already committed under
  `data/`, `server/assets/`, or baked into `server/lib/instructions.js`.

### Summary table

| What | Where | Status |
|---|---|---|
| Source code | `github.com/yehudakogan770/Kriahassessment`, branch `main` | confirmed |
| Live generator app | `https://yehudakogan770.github.io/Kriahassessment/` | confirmed working |
| Custom domain | `ganeinuacademy.org` (GoDaddy) | **confirmed broken** - redirects to Instagram, needs GoDaddy DNS fix |
| Reading Progress backend | would need `server/` hosted somewhere | **not deployed anywhere** found |
| Database | local SQLite, `data/progress.sqlite` | exists only on whatever machine runs the server |
| Env vars | `PORT` only | not a secret |
| Secrets in repo | none found | keep it that way |

## 6. Finished, left, and skipped

### Finished and live (on `https://yehudakogan770.github.io/Kriahassessment/` as of this handoff)

- Core generator: word-bank selection, live preview, PDF/Word export,
  Teacher/Student document pairing, 30 categories across letters, nekudot,
  sheva rules, silent letters, dagesh confusions, etc.
- Per-category word `limit` and `repeat` count controls.
- Uniform word font size; 8-letter minimum-gap shuffle for repeated
  letters/words.
- Optional Letters/Nekudot "by heart" recitation checklists
  (teacher-copy only), in the school's own letter/nekudot teaching order.
- Compact 2-column Teacher Testing Instructions.
- "Show Grade 2 rules" toggle on the Exception Rules / Sheva Rules groups.
- Two renamed categories (Shin/Sin dagesh-sharing categories), propagated
  correctly to their new generated ids.
- Live preview: fit-to-width scaling, scrollable for height, with dashed
  page-break markers and a running page count (estimated from real
  measured row heights against real print page dimensions - preview-only,
  doesn't affect actual PDF/docx output).
- Working Reset button for the category picker.
- School branding (logo + "Ganeinu Academy" name) on all 4 pages/surfaces,
  now on the sunburst/open-book logo (2nd version - see §8).
- Reading Progress tracking, all 5 planned increments (server app only -
  see the live-status caveat in §5): teacher accounts, student roster,
  skill-taxonomy-based assessment logging with fluency timing and mistake
  detail, class/school comparison report with General/Detailed views.
- `CNAME` + GitHub Pages workflow wiring for the custom domain (code side
  only - see the DNS gap in §5).
- This handoff itself: `CLAUDE.md`, `HANDOFF.md`, `handoff-files/` (§7),
  README corrections (stale category count, stale "numbered words" claim,
  missing Reading Progress section, overstated custom-domain status),
  favicon added to the 3 server-app HTML pages (was silently 404ing).

### Explicitly left unfinished - needs your decision, not a technical blocker

- **"Full Assessment" reference-format mode.** Scoped (both a new
  alternate mode *and* borrowing the reference's visual style into the
  existing builder) but the word source for it was explicitly deferred by
  you ("ask me later"). Nothing further should be built here until you
  decide: should it reuse the existing word bank, or does it need its own
  curated word lists pulled from the reference document? A mockup
  demonstrating the visual style (using the existing word bank) was
  already generated and shown to you during that chat - it's preserved at
  `handoff-files/full-assessment-reference-style-mockup.pdf` /
  `.docx` so a new session has it without re-deriving it.
- **Teacher-to-parent results sharing.** Only discussed as an exploratory
  question ("what are your thoughts on...") - you got a brief verbal
  answer, never asked for it to be built, so it wasn't. Worth revisiting
  if you want it; no design work has been done beyond that one exchange.

### Can't be finished without your access - listed, not attempted

- **`ganeinuacademy.org` DNS / domain forwarding at GoDaddy** - see §5's
  "Domain registrar" entry for exactly what needs to change. Needs your
  GoDaddy login.
- **Deciding whether/where to deploy the Express server app** (so Reading
  Progress is actually usable by real teachers, not just in a dev
  sandbox) - needs a hosting decision and account from you (Render,
  Railway, a VPS, etc. would all work; none is set up).

No other known bugs or broken parts remain - this handoff included a full
smoke test (every `/api/...` route: categories, preview, generate in both
formats and roles, auth signup/login/logout, the full Reading Progress
student/assessment/report flow) and a UI pass (Puppeteer against both the
standalone file and the server app's frontend, zero JS errors, real
rendered word/page counts, logo loading correctly) - see §9 for exact
results.

## 7. Files in `handoff-files/`

Everything here is either something you uploaded during the original chat
that was never saved into the repo itself, or something generated during
that chat and shown to you but not committed anywhere. Nothing here is
referenced by the running app - it's historical/reference material for
whoever (human or Claude) picks this project up next.

| File | What it is |
|---|---|
| `Teacher_Kriah_assessment_2026-reference-format.docx` | The school's real, hand-made paper assessment, which you uploaded as the format to mimic. The original upload file itself was no longer recoverable from this session's storage by the time this handoff was written, but its full content survived (it had already been unzipped for analysis) and was reassembled into a valid `.docx` here - verified by re-parsing its XML, content reads correctly. This is the source material behind `recitation.js`'s letter/nekudot ordering and the compact-instructions/G2-toggle work, and is what the "Full Assessment" mode (§6, still unfinished) would be mimicking further. |
| `full-assessment-reference-style-mockup.pdf` / `.docx` | A concrete mockup generated during that chat, using the *existing* word bank laid out in the reference document's visual style, sent to you so you could see the direction before committing to building it as a real feature. Not wired into the app - just a preview. |
| `mobile-screenshot-page-break-request.jpg` | The phone screenshot of the live site you sent when asking for the live preview to show real print page breaks - the feature that request led to (page-break markers + page count) is now live; kept for context on why it looks the way it does. |
| `logo-v1-superseded-children-silhouettes.png` | The first school logo used on the site (two children walking toward each other above an open book). Replaced by the current sunburst/open-book logo partway through the project (§8) - kept for reference in case you ever want to switch back or compare. |

The **current** logo (the one actually live on the site) is not duplicated
here since it's already committed at `server/assets/branding/ganeinu-
academy-logo.jpg` / `public/ganeinu-academy-logo.jpg`.

All five files together are a few hundred KB - no size concerns, all pushed
to the repo normally.

## 8. Conversation summary, start to finish

This covers the entire project, across what was originally one long chat
(summarized partway through when it ran long, then continued) plus this
final handoff session.

**Initial build.** Started from the school's existing hand-made word bank
spreadsheet. Built the core generator: category picker, live preview,
Teacher/Student PDF and Word export, the shared `server/lib/` document
logic, the GitHub Pages standalone publish pipeline, and a sign-in gate +
self-service logo upload for the standalone app. Early UI passes added a
professional navy color palette, fixed layout bugs, added a Grade/Class
field and per-category word limits, a shuffle for word order, the school's
first real logo with a round-mask treatment, uniform card sizing, grouped
categories, and a Teacher/Student pairing code so a teacher and student
copy generated together can be matched back up.

**Reading Progress (5 increments).** Added on top of the generator: teacher
accounts + a database (increment 1), students + assessment logging
(increment 2), a full skill taxonomy with detailed per-assessment fields
(increment 3), fluency timing with class/school comparison (increment 4),
and class/school report views with General vs. Detailed modes (increment
5). This is the feature later confirmed (§5) to not be deployed anywhere
live.

**A visual redesign** moved the Word/PDF output to a plainer,
print-appropriate style.

**A platform-scope correction:** early on, some work had been published to
a Claude.ai Artifact (a canvas/mirror) alongside the real site. The user
said explicitly: *"dont build it in the canves i only want it in the
website"* - stop publishing there, ship only to the real site going
forward. Told to leave the existing artifact alone, just stop updating it.
This stood for the rest of the project.

**A 6-item batch request** followed: number each *line* instead of each
word in the grid; move the "Shuruk in the beginning" category into the
Exception Rules group; add a Reset button; make all generated words one
font size; enforce an 8-letter minimum gap between repeats when generating
the Alef Bet; and a question about mimicking a reference format mentioned
earlier in the chat that turned out not to be in the session's own
history - the user was asked to resend it.

**The reference document.** The user uploaded
`Teacher_Kriah_assesment_2026.docx` (now preserved at
`handoff-files/Teacher_Kriah_assessment_2026-reference-format.docx`, §7).
Direct XML analysis of it (LibreOffice/pandoc were confirmed broken in this
sandbox, so this went through `unzip` + Python `xml.etree.ElementTree`
instead) revealed its letter-recitation order (dagesh/marked variant before
its plain counterpart) and nekudot teaching order, which became
`recitation.js`. The user then asked for an editable preview/mockup of what
mimicking it would actually look like before committing to building it -
a mockup PDF and docx were generated using the existing word bank in the
reference's visual style and sent over (preserved at
`handoff-files/full-assessment-reference-style-mockup.*`, §7).

**Mid-batch adjustments**, each applied as it came in: a configurable
per-category repeat count (surfacing and fixing a real pre-existing server
bug where `/api/preview` and `/api/generate` silently ignored client-sent
filters); the live preview made to fit the available width (after a first,
wrong attempt that scaled to fit both dimensions and produced an
unreadably tiny preview - corrected to width-only scaling with a
vertically-scrollable wrapper); and, after seeing per-line numbers live,
a direct reversal - *"take away the gray numbers next to each word"* -
removing numbering from the grid entirely (what remains is the
teacher-only category reference badge).

**Scope re-confirmation for the reference-format feature:** asked again
later (*"ask me the qs you asked me before"*), the user confirmed they
want both a new alternate mode and to borrow the reference's visual style
into the existing builder, picked "ask me later" for the word-source
question (left deliberately unfinished - §6), and left the font choice to
Claude's judgment (David Libre was already in use, kept for consistency).

**An exploratory aside**, answered briefly per the project's established
"don't implement exploratory questions" convention and not acted on
further: the user asked what Claude thought about building a way for
teachers to share results with parents.

**Custom domain setup.** The user asked for "the codes to give to GoDaddy"
for `ganeinuacademy.org`, confirmed it was the root domain, then
(impatiently) just wanted the values immediately. A `CNAME` file and the
corresponding GitHub Actions workflow change were added and shipped. As
discovered during this final handoff (§5), the registrar side of this
was evidently never completed or has since changed - the domain currently
redirects to the school's Instagram page instead of this site.

**Branding rollout.** The user asked for the school logo and "Ganeinu
Academy" text on every page, uploading a first logo (two children walking
toward an open book). Shipped across all 4 surfaces.

**A second batch of fixes:** corrected the dotted-letter and nekudot
recitation order (both had real bugs - dagesh-marked letters sorting after
their plain form instead of before, and nekudot not being sorted at all);
made the recitation sections teacher-copy-only (reversing the original
both-roles design after the user pointed out it's the teacher's oral
checklist, not something students read); renamed two categories to match
the reference document's wording; added the Grade 2 rules show/hide
toggle (which, while building it, surfaced and fixed a real, severe bug -
the toggle checkbox was being picked up by the "which categories are
selected" logic since it queried too broadly, breaking the entire
preview/generate flow); and made the Teacher Testing Instructions a
compact 2-column layout.

**Link/credential requests.** The user asked for the site link and GoDaddy
codes again, and separately for the standalone app's sign-in passcode
(`ganeinu`).

**Page-break visibility.** After a mobile screenshot (preserved at
`handoff-files/mobile-screenshot-page-break-request.jpg`, §7) and a
request for the preview to show how many pages a selection would actually
print as, the live preview gained dashed page-break markers and a running
page count, computed from real measured word-grid row heights against the
real print page content area - preview-only, doesn't touch actual PDF/docx
output.

**A second, different logo.** The user uploaded a new design (blue
sunburst rays over an open book, "GANEINU" in bold maroon, "ACADEMY" in
blue, white background) to replace the first one "everywhere." This was
completed at the very start of this final session: the asset was swapped
into `server/assets/branding/` and `public/` (kept as the original `.jpg`
rather than converted to `.png`, reverting the branding pipeline's
asset-path/MIME handling back to how it worked before the first logo
swap), the standalone bundle rebuilt, and the result verified with
Puppeteer across all 4 surfaces (all load correctly, no broken images) -
shipped as PR #27.

**This handoff.** The user announced they were moving to a new Claude
account and this chat would not transfer, and asked for: everything saved
and pushed; any in-progress/planned work finished, with known issues fixed
and tested; a full map of where the project's pieces live; every
chat-connected file not already in the repo collected into the repo; and
`CLAUDE.md` + this file written for a new session to pick up from cold.
That work is what produced this document - see §9 for exactly what was
done in this pass.

## 9. This handoff session's own work log

Everything below happened in this final session, after the account-move
request came in (the sunburst-logo swap just above happened in the same
session but *before* that request, as a normal continuation of the prior
work - it's listed in §8, not repeated here).

1. **Verified nothing was uncommitted** - working tree was already clean,
   logo swap (PR #27) already merged and deployed.
2. **Full smoke test of the server app** - wrote and ran a test script
   covering `GET /api/categories`, `POST /api/preview` (plain and with
   filters/repeat/recitation sections), `POST /api/generate` (docx and
   PDF, both roles), `POST /api/auth/signup`, `GET /api/auth/me`,
   `POST /api/auth/login` (wrong-password rejection), the full Reading
   Progress flow (create student, fetch skill taxonomy, log an
   assessment, fetch the report, confirm the student appears with correct
   data), the unauthenticated-401 case, and logout. First run found 2
   failures that turned out to be bugs in the *test script* itself (wrong
   field names assumed for the skill taxonomy shape), not the app - fixed
   the test, re-ran, **14/14 passed**.
3. **UI smoke test** - Puppeteer against both the standalone file and the
   server app's real frontend (`localhost`), selecting real categories via
   real checkbox clicks, confirming real rendered word/page counts and a
   correctly-loading logo, zero `pageerror`s. Found one cosmetic issue:
   the server app's 3 HTML pages had no declared favicon, so browsers
   were requesting (and getting a 404 for) `/favicon.ico`. Fixed by adding
   `<link rel="icon">` pointing at the existing logo file to all three
   (matches what the standalone app already does for its tab icon).
4. **Checked for build drift** - re-ran `npm run convert-data` and `npm
   run build-standalone`; the only diff either produced was the
   `generatedAt` timestamp field, confirming no real drift between the
   committed word bank/bundle and their sources. Reverted those two
   timestamp-only diffs rather than committing no-op noise.
5. **Corrected stale `README.md`** - it said 28 categories (actually 30),
   described per-word sequential numbering that had been removed earlier
   in the project, didn't mention the Reading Progress feature at all,
   and listed the `github.io` URL as secondary to `ganeinuacademy.org`
   (backwards, given finding #6 below). All corrected; a new "Reading
   Progress tracking (server app only)" section was added, and the route
   list in "How it's built" now mentions `auth.js`/`progress.js`/
   `db.js`/`skills.js`.
6. **Checked the live custom domain directly** (not just the GitHub
   Actions deploy status) and found `ganeinuacademy.org` currently
   redirects to the school's Instagram page rather than this site - see
   §5 and §6 for the full detail. This is the most important open item
   from this session.
7. **Confirmed no secrets anywhere in the repo** - no `.env` files, a
   pattern scan for API-key/secret-like strings across all source files
   found nothing real (one expected false-positive inside embedded
   base64 font data, inspected and confirmed harmless).
8. **Collected `handoff-files/`** - see §7 for the full list and what each
   file is.
9. **Wrote `CLAUDE.md` and this file.**
10. **Committed and pushed** all of the above to
    `claude/hebrew-reading-assessment-98v0vr` - **deliberately not merged
    to `main`**, since a merge would auto-deploy via GitHub Pages and the
    user wouldn't be able to verify the result together in this account
    transition. See the PR this session opened for exactly what's staged
    for your review.

No code behavior changed in this session beyond the favicon addition
(#3) - everything else was verification, documentation, and the
`handoff-files/` collection.
