# CLAUDE.md

Instructions for any Claude session working in this repo.

**Read `HANDOFF.md` first** for the full project history, current status,
what's finished vs. left vs. skipped, and where everything lives (hosting,
domain, DB, accounts). This file is the shorter "how to work here" reference;
`HANDOFF.md` is the long-form record.

## What this project is

A Hebrew reading (Kriah) assessment generator for Ganeinu Academy. Teachers
pick word-bank categories (letters, nekudot/vowels, sheva rules, silent
letters, dagesh confusions, etc.) and generate matching **Teacher** and
**Student** assessment sheets as PDF or Word. It ships three ways from one
shared codebase: a live static site (GitHub Pages), a single-file standalone
HTML app, and a self-hostable Express server app that adds Reading Progress
tracking (teacher accounts + a database) on top. See `README.md` for the
full breakdown and `HANDOFF.md` for how it's structured and why.

## Who this is for and how they work

The user is a school administrator/rabbi (not a developer) building this for
their school's teachers. Consequences for how you should operate:

- Explain in plain terms, not framework jargon. Don't assume they'll read
  code.
- They move fast and expect you to move fast too. Messages are often short,
  sometimes urgent/impatient ("JUST GIVE ME THE CODES") - when that happens,
  answer the literal immediate ask first, concisely, before anything else.
- They will reverse a decision after seeing it live (e.g. asked for per-word
  numbers, then asked to remove them a few turns later after seeing the
  real output). That's normal for this project, not a sign you did
  something wrong - ship fast, be ready to adjust, don't over-invest in one
  direction before they've seen it.
- For exploratory questions ("what do you think about X", "how should we
  approach Y") - answer in 2-3 sentences with a recommendation and the main
  tradeoff. Don't implement. Let them redirect or greenlight first.
- When they say "ask me later" or otherwise explicitly defer a decision,
  leave it alone until they bring it back up. Don't quietly build it
  "while you're at it."
- When they explicitly hand you a judgment call ("whatever is cleaner",
  "your choice"), make the call yourself and say what you picked and why -
  don't bounce it back as a question.

## Standing workflow practice

Established over this whole project and expected to continue: **ship
incrementally without waiting to be asked** - for each discrete change,
commit, push, open a PR, merge it, and verify the deploy succeeded (GitHub
Actions), all in the same turn, without a separate "should I ship this?"
check-in. See the git workflow details below for the exact commands.

**Exception - when you can't supervise the result together:** merges to
`main` auto-deploy to the live site (`.github/workflows/deploy-pages.yml`
fires on every push to `main` that touches `standalone/kriah-assessment-
builder.html` or `CNAME`). If the user signals they're stepping away, switching
accounts, or otherwise won't be able to check the result with you right
after - or if you're about to merge something you haven't been able to fully
verify - push to a branch, open a PR if useful, and tell them it's ready for
review instead of merging on your own. This is what happened at the end of
this project's first chat: see "Pending — needs your review" in
`HANDOFF.md`.

## Git workflow specifics

- Repo: `yehudakogan770/Kriahassessment` (public). Default/production
  branch: `main`.
- This project does the PR/merge/reconcile cycle for essentially every
  change, including small ones. The pattern that's worked throughout:
  1. Commit on a feature branch, push with `-u origin <branch>`.
  2. Open a PR, merge it (**squash merge**).
  3. Reconcile the local branch so it doesn't diverge from the squashed
     history: `git fetch origin main`, confirm `git diff HEAD origin/main
     --stat` is empty (content-identical), `git reset --soft origin/main`,
     then `git push --force-with-lease`.
  4. Verify the deploy: check the `deploy-pages.yml` workflow run
     (GitHub Actions), not just that the merge succeeded.
- No CI/test gate blocks merges - there is no automated test suite (see
  below), so "verify it works" is on you, manually, before you ship.

## No automated tests - how to actually verify a change

`package.json` has no `test` script. Don't assume one exists or add a test
framework unprompted. To verify changes:

- **Server app logic (generation, auth, Reading Progress DB):** start the
  server (`PORT=<free-port> node server/index.js`, run in background) and
  hit the real `/api/...` routes with `fetch`/`curl` - categories, preview,
  generate (both PDF and docx, both roles), and for Reading Progress:
  signup → students → assessments → report, including the 401-when-
  unauthenticated case. A full working example of this lives in this
  session's handoff (see `HANDOFF.md`); rebuild a similar script rather than
  trusting that "the code looks right."
- **UI / both frontends:** Puppeteer (pre-installed, see environment notes -
  don't run `playwright install` or re-download Chromium). Load the real
  page (`file://.../standalone/kriah-assessment-builder.html` for the
  standalone app, or `http://localhost:<port>/index.html` for the server
  app's frontend), attach a `pageerror` listener and assert zero errors,
  interact with real checkboxes/buttons (not just reading source), and read
  back real rendered state (word count, page count, logo `naturalWidth`,
  etc.) rather than assuming a change took effect.
- **docx correctness:** LibreOffice/`soffice`, `pandoc`, and `pdftoppm`/
  poppler are **not usable in this environment** (confirmed broken/missing
  repeatedly across this project) - don't spend time retrying them. Instead
  `unzip` the `.docx` and parse `word/document.xml` with Python's
  `xml.etree.ElementTree` (**never regex** - it misses/mis-extracts `<w:t>`
  runs). Puppeteer/Chromium **is** reliable here for HTML/PDF/visual checks.
- **Build drift:** after touching `data/source/*.xlsx` or anything under
  `server/lib/`, run `npm run convert-data && npm run build-standalone` and
  `git diff` the results - if the only diff is the `generatedAt` timestamp
  in `data/categories.json`, that's a no-op, revert it rather than
  committing timestamp noise. If there's a real diff, that's the point: the
  standalone bundle must be committed in sync with its sources, or the live
  site silently drifts from the server app.

## Known sandbox-architecture landmine - read before editing `server/lib/`

`scripts/build-standalone.js` builds the standalone app by **concatenating**
`server/lib/{instructions,recitation,assemble,htmlTemplate,docxBuilder}.js`
(stripped of `require`/`module.exports`) into **one shared script scope**,
plus the word bank and fonts, into a single HTML file. This means:

- Any top-level `const`/`function` name declared in more than one of those
  files **collides and throws at runtime in the bundled build only** - it
  won't show up as an error in normal Node usage of `server/`, only after
  `npm run build-standalone` when you actually open/test the standalone
  file. This has broken the build multiple times in this project already
  (`GENERAL_SKILLS`, `chunk`).
- Before adding a new top-level identifier to any file under `server/lib/`,
  check it isn't already used in the others. After any change there,
  rebuild standalone and load it in Puppeteer with a `pageerror` listener
  before calling the change done.

## Coding style and structure

- Plain Node/Express (CommonJS, `require`), vanilla JS on the frontend (no
  framework, no build step for `public/` or `standalone/src/`) - keep new
  code in that style, don't introduce a bundler, TypeScript, or a frontend
  framework unless asked.
- `server/lib/` is the single source of truth for document logic (word
  assembly, HTML/PDF/docx rendering, instructions text, recitation
  ordering) and is shared verbatim by both the server app and the
  standalone bundle - see the landmine note above. Don't fork logic between
  the two surfaces; add it once in `server/lib/` and let both consume it.
- `data/categories.json` is **generated** (`npm run convert-data` from
  `data/source/*.xlsx`) but is committed to the repo, not gitignored -
  that's intentional (both apps read it directly, including the standalone
  bundle at build time). Don't hand-edit it; edit the source spreadsheet.
- `standalone/kriah-assessment-builder.html` is also a **committed build
  artifact** (`npm run build-standalone`) - same reasoning. Never hand-edit
  it directly; edit `standalone/src/*` or `server/lib/*` and rebuild.
- Comments: sparse, only for non-obvious WHY (a subtle invariant, a
  workaround, a constraint that would surprise a reader) - this codebase
  already follows that style, match it.
- Hebrew/RTL text throughout - when touching rendering code, be deliberate
  about `dir="rtl"` contexts and don't assume LTR string/array operations
  (e.g. reversal, truncation) behave the way you'd expect.

## Always / never

- **Always** rebuild and re-verify the standalone bundle after touching
  `server/lib/` or `data/source/`, before calling a change done.
- **Always** test the real UI (Puppeteer) for any frontend change, not just
  that the server returns 200 - this project has shipped real UI bugs (e.g.
  a stray toggle checkbox silently breaking category selection) that only
  showed up when actually clicking through the flow, not in a narrower
  isolated test.
- **Always** keep `README.md` accurate when behavior changes - this project
  has accumulated stale-doc bugs before (wrong category count, a removed
  feature still described, a live URL claim that turned out not to be
  true). Treat a doc claim you haven't verified as suspect, not as fact.
- **Never** hand-edit `data/categories.json` or
  `standalone/kriah-assessment-builder.html` directly - they're generated.
- **Never** assume a claimed-live URL is actually serving what you think -
  verify with a real request. (`ganeinuacademy.org` is a live example of
  this going wrong - see `HANDOFF.md`.)
- **Never** merge a batch of unverified work straight to `main` when the
  user won't be able to check it with you right away - see the workflow
  exception above.
- **Never** commit secrets. This project currently has none (no `.env`, no
  API keys, no third-party service credentials anywhere) - keep it that
  way; if a future feature needs one, it goes in an untracked `.env` (add
  to `.gitignore`) and gets documented (name + source, never the value) in
  `HANDOFF.md`.
