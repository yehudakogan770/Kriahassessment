const crypto = require("crypto");
const { getDb } = require("./db");

const SCRYPT_KEYLEN = 64;
const SESSION_COOKIE = "kriah_session";
const SESSION_DAYS = 30;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function createSession(teacherId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  getDb()
    .prepare("INSERT INTO sessions (token, teacher_id, expires_at) VALUES (?, ?, ?)")
    .run(token, teacherId, expiresAt);
  return { token, expiresAt };
}

function destroySession(token) {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** Returns the teacher row for a valid, unexpired session token, or null. */
function teacherForSession(token) {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT teachers.id, teachers.name, teachers.email
       FROM sessions JOIN teachers ON teachers.id = sessions.teacher_id
       WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`
    )
    .get(token);
  return row || null;
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const teacher = teacherForSession(token);
  if (!teacher) {
    return res.status(401).json({ error: "Not signed in." });
  }
  req.teacher = teacher;
  next();
}

module.exports = {
  SESSION_COOKIE,
  SESSION_DAYS,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  teacherForSession,
  requireAuth,
};
