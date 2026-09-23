const express = require("express");
const { assemble, InvalidSelectionError } = require("../lib/assemble");
const { buildHtml } = require("../lib/htmlTemplate");
const { renderPdf } = require("../lib/pdfBuilder");
const { renderDocx } = require("../lib/docxBuilder");
const { CONTENT_TYPES, filenameFor } = require("../lib/download");

const router = express.Router();

class ValidationError extends Error {}

function clampText(value, maxLen) {
  if (value === undefined || value === null) return "";
  const str = String(value).trim();
  return str.slice(0, maxLen);
}

// Keeps only well-shaped entries for categories actually in this request,
// clamped to sane bounds - the client only ever needs to narrow/repeat a
// category it already selected, so anything else is dropped rather than
// erroring the whole request over one bad entry.
function sanitizeFilters(filters, categoryIds) {
  if (!filters || typeof filters !== "object") return {};
  const idSet = new Set(categoryIds);
  const clean = {};
  for (const [id, f] of Object.entries(filters)) {
    if (!idSet.has(id) || !f || typeof f !== "object") continue;
    const entry = {};
    if (Array.isArray(f.include)) {
      entry.include = f.include.filter((w) => typeof w === "string").slice(0, 500).map((w) => w.slice(0, 40));
    }
    if (Number.isFinite(f.limit)) entry.limit = Math.min(Math.max(Math.round(f.limit), 1), 999);
    if (Number.isFinite(f.repeat)) entry.repeat = Math.min(Math.max(Math.round(f.repeat), 1), 50);
    if (entry.include?.length || entry.limit || entry.repeat) clean[id] = entry;
  }
  return clean;
}

function parseRequest(body) {
  const {
    categoryIds,
    role,
    columns,
    studentName,
    grade,
    date,
    title,
    orientation,
    hideDate,
    matchCode,
    filters,
    includeLettersRecitation,
    includeNekudotRecitation,
  } = body || {};

  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new ValidationError("categoryIds must be a non-empty array.");
  }
  if (categoryIds.length > 100 || categoryIds.some((id) => typeof id !== "string" || id.length > 80)) {
    throw new ValidationError("categoryIds contains an invalid entry.");
  }
  if (role !== "teacher" && role !== "student") {
    throw new ValidationError('role must be "teacher" or "student".');
  }

  const meta = {
    title: clampText(title, 120) || undefined,
    studentName: clampText(studentName, 80),
    grade: clampText(grade, 40),
    date: clampText(date, 40),
    hideDate: !!hideDate,
    columns: Math.min(Math.max(Number(columns) || 3, 2), 8),
    orientation: orientation === "landscape" ? "landscape" : "portrait",
    includeLettersRecitation: !!includeLettersRecitation,
    includeNekudotRecitation: !!includeNekudotRecitation,
  };

  // Lets a Teacher and Student request generated separately still land on
  // the same shuffled word order and pairing code - see assemble()'s
  // matchCode param. Not required: omitted, assemble() just makes up a
  // fresh one.
  const matchCodeClean = clampText(matchCode, 20) || undefined;
  const cleanFilters = sanitizeFilters(filters, categoryIds);

  return { categoryIds, role, meta, matchCode: matchCodeClean, filters: cleanFilters };
}

router.post("/generate", async (req, res) => {
  try {
    const { categoryIds, role, meta, matchCode, filters } = parseRequest(req.body);
    const format = req.body?.format;
    if (format !== "pdf" && format !== "docx") {
      throw new ValidationError('format must be "pdf" or "docx".');
    }

    const assembled = assemble(categoryIds, filters, matchCode);
    const buffer =
      format === "pdf"
        ? await renderPdf({ role, assembled, meta })
        : await renderDocx({ role, assembled, meta });

    const filename = filenameFor({ title: meta.title, role, format, date: meta.date });
    res.setHeader("Content-Type", CONTENT_TYPES[format]);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof InvalidSelectionError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("generate failed:", err);
    res.status(500).json({ error: "Failed to generate document." });
  }
});

router.post("/preview", (req, res) => {
  try {
    const { categoryIds, role, meta, matchCode, filters } = parseRequest(req.body);
    const assembled = assemble(categoryIds, filters, matchCode);
    const html = buildHtml({ role, assembled, meta });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof InvalidSelectionError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("preview failed:", err);
    res.status(500).json({ error: "Failed to build preview." });
  }
});

module.exports = router;
