const express = require("express");
const { getDb } = require("../lib/db");
const { requireAuth } = require("../lib/auth");
const {
  SKILL_TAXONOMY,
  LETTER_CONFUSION_CATEGORIES,
  VOWEL_CONFUSION_CATEGORIES,
  FLUENCY_NOTE_OPTIONS,
  isValidCategory,
  isValidSkill,
} = require("../lib/skills");

const router = express.Router();
router.use("/progress", requireAuth);

const MASTERY_LEVELS = ["mastered", "approaching", "progressing"];
const FLUENCY_NOTE_IDS = FLUENCY_NOTE_OPTIONS.map((o) => o.id);
const MISTAKE_DETAIL_FIELDS = [
  "misreadCount",
  "lookAlikeLetters",
  "soundAlikeLetters",
  "phonemicMixups",
  "vowelNameConfusion",
  "vowelSoundConfusion",
  "vowelBlendingConfusion",
];

function clampText(value, maxLen) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLen);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Keeps only known keys/types, clamps text length, drops empties -
 * returns null if nothing meaningful was provided (so the column can
 * stay NULL instead of storing "{}"). */
function sanitizeMistakeDetail(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const field of MISTAKE_DETAIL_FIELDS) {
    if (field === "misreadCount") {
      const n = Number(raw[field]);
      if (Number.isFinite(n) && n >= 0) out[field] = Math.round(n);
      continue;
    }
    const text = clampText(raw[field], 300);
    if (text) out[field] = text;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeFluencyNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id) => FLUENCY_NOTE_IDS.includes(id)))];
}

function parseAssessmentRow(row) {
  return {
    ...row,
    fluencyNotes: row.fluencyNotes ? JSON.parse(row.fluencyNotes) : [],
    mistakeDetail: row.mistakeDetail ? JSON.parse(row.mistakeDetail) : null,
  };
}

router.get("/progress/skills", (req, res) => {
  res.json({
    taxonomy: SKILL_TAXONOMY,
    letterConfusionCategories: LETTER_CONFUSION_CATEGORIES,
    vowelConfusionCategories: VOWEL_CONFUSION_CATEGORIES,
    fluencyNoteOptions: FLUENCY_NOTE_OPTIONS,
  });
});

router.get("/progress/students", (req, res) => {
  const students = getDb()
    .prepare(
      `SELECT students.id, students.name, students.grade, students.created_at,
              COUNT(assessments.id) AS assessmentCount,
              MAX(assessments.assessed_on) AS lastAssessedOn
       FROM students
       LEFT JOIN assessments ON assessments.student_id = students.id
       GROUP BY students.id
       ORDER BY students.name COLLATE NOCASE`
    )
    .all();
  res.json({ students });
});

router.post("/progress/students", (req, res) => {
  const name = clampText(req.body?.name, 80);
  const grade = clampText(req.body?.grade, 40);
  if (!name) return res.status(400).json({ error: "Student name is required." });

  const info = getDb()
    .prepare("INSERT INTO students (name, grade, created_by) VALUES (?, ?, ?)")
    .run(name, grade || null, req.teacher.id);
  res.json({ student: { id: info.lastInsertRowid, name, grade: grade || null } });
});

function getStudentOr404(req, res) {
  const id = Number(req.params.id);
  const student = getDb().prepare("SELECT * FROM students WHERE id = ?").get(id);
  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return null;
  }
  return student;
}

router.get("/progress/students/:id", (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;

  const rows = getDb()
    .prepare(
      `SELECT assessments.id, assessments.category, assessments.skill, assessments.mastery,
              assessments.notes, assessments.next_step AS nextStep,
              assessments.fluency_notes AS fluencyNotes, assessments.mistake_detail AS mistakeDetail,
              assessments.assessed_on AS assessedOn, assessments.created_at AS createdAt,
              teachers.name AS teacherName
       FROM assessments
       JOIN teachers ON teachers.id = assessments.teacher_id
       WHERE assessments.student_id = ?
       ORDER BY assessments.assessed_on DESC, assessments.id DESC`
    )
    .all(student.id);

  res.json({ student, assessments: rows.map(parseAssessmentRow) });
});

router.post("/progress/students/:id/assessments", (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;

  const category = clampText(req.body?.category, 60);
  const skill = clampText(req.body?.skill, 120);
  const mastery = clampText(req.body?.mastery, 20);
  const notes = clampText(req.body?.notes, 2000);
  const nextStep = clampText(req.body?.nextStep, 1000);
  const assessedOn = clampText(req.body?.assessedOn, 10) || todayIso();
  const fluencyNotes = sanitizeFluencyNotes(req.body?.fluencyNotes);
  const mistakeDetail = sanitizeMistakeDetail(req.body?.mistakeDetail);

  if (!isValidCategory(category)) {
    return res.status(400).json({ error: "Unknown skill category." });
  }
  if (!isValidSkill(category, skill)) {
    return res.status(400).json({ error: "That skill doesn't belong to the chosen category." });
  }
  if (!MASTERY_LEVELS.includes(mastery)) {
    return res.status(400).json({ error: "Mastery must be one of: " + MASTERY_LEVELS.join(", ") });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assessedOn)) {
    return res.status(400).json({ error: "assessedOn must be a YYYY-MM-DD date." });
  }

  const info = getDb()
    .prepare(
      `INSERT INTO assessments
         (student_id, teacher_id, category, skill, mastery, notes, next_step, fluency_notes, mistake_detail, assessed_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      student.id,
      req.teacher.id,
      category,
      skill,
      mastery,
      notes || null,
      nextStep || null,
      JSON.stringify(fluencyNotes),
      mistakeDetail ? JSON.stringify(mistakeDetail) : null,
      assessedOn
    );

  res.json({
    assessment: {
      id: info.lastInsertRowid,
      category,
      skill,
      mastery,
      notes: notes || null,
      nextStep: nextStep || null,
      fluencyNotes,
      mistakeDetail,
      assessedOn,
      teacherName: req.teacher.name,
    },
  });
});

module.exports = router;
