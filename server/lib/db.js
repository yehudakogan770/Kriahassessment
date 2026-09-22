const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DB_PATH = path.join(DATA_DIR, "progress.sqlite");

let db = null;

function getDb() {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Students are shared school-wide (not owned by one teacher) so any
    -- signed-in teacher can log and review progress for the same student
    -- across grades/skills, and so a later increment can roll up class-
    -- and school-wide comparisons per the original spec.
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT,
      created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      skill TEXT NOT NULL,
      mastery TEXT NOT NULL CHECK (mastery IN ('mastered', 'approaching', 'progressing')),
      notes TEXT,
      assessed_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrate(db);

  return db;
}

// Additive, idempotent column migrations - safe to run against a database
// created before these columns existed (increment 2) as well as a brand
// new one. Only ever adds columns, never drops/renames, so older rows
// just read back with NULLs for fields they predate.
function migrate(db) {
  const existing = new Set(db.prepare("PRAGMA table_info(assessments)").all().map((c) => c.name));
  const addColumn = (name, ddl) => {
    if (!existing.has(name)) db.exec(`ALTER TABLE assessments ADD COLUMN ${ddl}`);
  };

  // Top-level skill category (see server/lib/skills.js) - `skill` already
  // existed as free text in increment 2; it now holds one of that
  // category's specific skills instead.
  addColumn("category", "category TEXT");
  // JSON array of FLUENCY_NOTE_OPTIONS ids, e.g. ["hesitancy"].
  addColumn("fluency_notes", "fluency_notes TEXT");
  // Free text: how the teacher suggests the student practice next.
  addColumn("next_step", "next_step TEXT");
  // JSON object: { misreadCount, lookAlikeLetters, soundAlikeLetters,
  // phonemicMixups, vowelNameConfusion, vowelSoundConfusion,
  // vowelBlendingConfusion } - see server/routes/progress.js.
  addColumn("mistake_detail", "mistake_detail TEXT");
  // How long the assessment took, in whole seconds - lets a student's
  // fluency time be compared against their class (same grade) and the
  // whole school, for the same skill.
  addColumn("duration_seconds", "duration_seconds INTEGER");
}

module.exports = { getDb };
