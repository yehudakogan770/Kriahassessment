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

function parseRequest(body) {
  const { categoryIds, role, columns, studentName, date, title, orientation } = body || {};

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
    date: clampText(date, 40),
    columns: Math.min(Math.max(Number(columns) || 3, 2), 8),
    orientation: orientation === "landscape" ? "landscape" : "portrait",
  };

  return { categoryIds, role, meta };
}

router.post("/generate", async (req, res) => {
  try {
    const { categoryIds, role, meta } = parseRequest(req.body);
    const format = req.body?.format;
    if (format !== "pdf" && format !== "docx") {
      throw new ValidationError('format must be "pdf" or "docx".');
    }

    const assembled = assemble(categoryIds);
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
    const { categoryIds, role, meta } = parseRequest(req.body);
    const assembled = assemble(categoryIds);
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
