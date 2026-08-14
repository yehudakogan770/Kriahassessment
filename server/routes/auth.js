const express = require("express");
const { getDb } = require("../lib/db");
const {
  SESSION_COOKIE,
  SESSION_DAYS,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  requireAuth,
} = require("../lib/auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cookieOptions(req, expiresAt) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    expires: expiresAt ? new Date(expiresAt) : undefined,
    maxAge: expiresAt ? undefined : SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

router.post("/auth/signup", (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 80);
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 120);
  const password = String(req.body?.password || "");

  if (!name) return res.status(400).json({ error: "Name is required." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const db = getDb();
  const existing = db.prepare("SELECT id FROM teachers WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });

  const passwordHash = hashPassword(password);
  const info = db
    .prepare("INSERT INTO teachers (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name, email, passwordHash);

  const { token, expiresAt } = createSession(info.lastInsertRowid);
  res.cookie(SESSION_COOKIE, token, cookieOptions(req, expiresAt));
  res.json({ teacher: { id: info.lastInsertRowid, name, email } });
});

router.post("/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 120);
  const password = String(req.body?.password || "");

  const teacher = getDb().prepare("SELECT * FROM teachers WHERE email = ?").get(email);
  if (!teacher || !verifyPassword(password, teacher.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const { token, expiresAt } = createSession(teacher.id);
  res.cookie(SESSION_COOKIE, token, cookieOptions(req, expiresAt));
  res.json({ teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
});

router.post("/auth/logout", (req, res) => {
  destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ teacher: req.teacher });
});

module.exports = router;
