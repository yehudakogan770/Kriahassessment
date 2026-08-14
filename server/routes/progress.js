const express = require("express");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

// Placeholder for the Reading Progress feature - proves the account/session
// plumbing works end-to-end. Actual student/assessment data model comes in
// a later increment.
router.get("/progress/ping", requireAuth, (req, res) => {
  res.json({ ok: true, teacher: req.teacher });
});

module.exports = router;
