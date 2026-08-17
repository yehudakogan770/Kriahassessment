const express = require("express");
const { getDb } = require("../lib/db");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
router.use("/progress", requireAuth);

const MASTERY_LEVELS = ["mastered", "approaching", "progressing"];

function clampText(value, maxLen) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLen);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

  const assessments = getDb()
    .prepare(
      `SELECT assessments.id, assessments.skill, assessments.mastery, assessments.notes,
              assessments.assessed_on AS assessedOn, assessments.created_at AS createdAt,
              teachers.name AS teacherName
       FROM assessments
       JOIN teachers ON teachers.id = assessments.teacher_id
       WHERE assessments.student_id = ?
       ORDER BY assessments.assessed_on DESC, assessments.id DESC`
    )
    .all(student.id);

  res.json({ student, assessments });
});

router.post("/progress/students/:id/assessments", (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;

  const skill = clampText(req.body?.skill, 120);
  const mastery = clampText(req.body?.mastery, 20);
  const notes = clampText(req.body?.notes, 2000);
  const assessedOn = clampText(req.body?.assessedOn, 10) || todayIso();

  if (!skill) return res.status(400).json({ error: "Skill is required." });
  if (!MASTERY_LEVELS.includes(mastery)) {
    return res.status(400).json({ error: "Mastery must be one of: " + MASTERY_LEVELS.join(", ") });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assessedOn)) {
    return res.status(400).json({ error: "assessedOn must be a YYYY-MM-DD date." });
  }

  const info = getDb()
    .prepare(
      `INSERT INTO assessments (student_id, teacher_id, skill, mastery, notes, assessed_on)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(student.id, req.teacher.id, skill, mastery, notes || null, assessedOn);

  res.json({
    assessment: {
      id: info.lastInsertRowid,
      skill,
      mastery,
      notes: notes || null,
      assessedOn,
      teacherName: req.teacher.name,
    },
  });
});

module.exports = router;
