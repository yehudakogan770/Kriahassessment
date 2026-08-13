function slugifyFilename(text) {
  return String(text)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "kriah-assessment";
}

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function filenameFor({ title, role, format, date }) {
  const base = slugifyFilename(title || "Kriah-Assessment");
  const roleTag = role === "teacher" ? "Teacher" : "Student";
  const dateTag = date ? `-${slugifyFilename(date)}` : "";
  return `${base}-${roleTag}${dateTag}.${format}`;
}

module.exports = { CONTENT_TYPES, filenameFor };
