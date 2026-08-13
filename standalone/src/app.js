// Shared with the school-logo upload feature further down: same storage
// key, so a logo set from the header also drives the tab icon and the
// sign-in screen's mark, and a logo already saved from a previous visit
// applies to both before the auth gate even renders.
const LOGO_STORAGE_KEY = "kriah-school-logo";

function updateFavicon(dataUrl) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}

(function applyStoredLogoEarly() {
  let dataUrl;
  try {
    dataUrl = localStorage.getItem(LOGO_STORAGE_KEY);
  } catch (err) {
    dataUrl = null; // Storage unavailable - fall through to the built-in default.
  }
  dataUrl = dataUrl || DEFAULT_LOGO_DATA_URL;
  updateFavicon(dataUrl);
  const authMark = document.querySelector("#auth-form .mark");
  if (authMark) {
    const img = document.createElement("img");
    img.className = "auth-logo";
    img.src = dataUrl;
    img.alt = "School logo";
    authMark.replaceWith(img);
  }
})();

// Soft deterrent, not real security: the whole page - including this hash -
// ships to the browser, so anyone reading the source can find the passcode.
// It just keeps the link from being casually stumbled into. To change it,
// edit AUTH_PASSCODE in scripts/build-standalone.js and rebuild; leaving it
// blank there removes this gate entirely.
(function initAuthGate() {
  const gate = document.getElementById("auth-gate");
  const shell = document.getElementById("app-shell");
  const STORAGE_KEY = "kriah-auth-hash";

  function unlock() {
    gate.hidden = true;
    shell.hidden = false;
  }

  if (!AUTH_PASSCODE_HASH) {
    unlock();
    return;
  }

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  try {
    if (localStorage.getItem(STORAGE_KEY) === AUTH_PASSCODE_HASH) {
      unlock();
      return;
    }
  } catch (err) {
    // localStorage unavailable - fall through to asking every time.
  }

  const form = document.getElementById("auth-form");
  const input = document.getElementById("auth-passcode");
  const error = document.getElementById("auth-error");
  input.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(input.value);
    if (hash === AUTH_PASSCODE_HASH) {
      try {
        localStorage.setItem(STORAGE_KEY, hash);
      } catch (err) {
        // Can't persist - they'll just need to re-enter it next visit.
      }
      unlock();
    } else {
      error.hidden = false;
      input.value = "";
      input.focus();
    }
  });
})();

(() => {
  // Section dividers for the category list, keyed by each category's
  // canonical order (from categories.json) - a light scanning aid that
  // mirrors the word bank's own sequence rather than an invented taxonomy.
  const GROUP_BREAKS = {
    1: "Letters & Nekudot",
    4: "Silent Letters",
    7: "Yud/Vav Endings",
    8: "Sheva Rules",
    17: "Shuruk & Dagesh",
    21: "Shared Dot",
    22: "Word Endings",
  };

  const el = {
    title: document.getElementById("doc-title"),
    studentName: document.getElementById("student-name"),
    date: document.getElementById("doc-date"),
    columns: document.getElementById("columns"),
    orientation: document.getElementById("orientation"),
    categoryList: document.getElementById("category-list"),
    selectAll: document.getElementById("select-all"),
    clearAll: document.getElementById("clear-all"),
    downloadTeacher: document.getElementById("download-teacher"),
    downloadStudent: document.getElementById("download-student"),
    statusMessage: document.getElementById("status-message"),
    previewFrame: document.getElementById("preview-frame"),
    previewPage: document.getElementById("preview-page"),
    previewPlaceholder: document.getElementById("preview-placeholder"),
    printFrame: document.getElementById("print-frame"),
    headerMeta: document.getElementById("header-meta"),
    tabs: Array.from(document.querySelectorAll(".preview-tabs .tab")),
    importFile: document.getElementById("import-file"),
    resetSource: document.getElementById("reset-source"),
    sourceLabel: document.getElementById("source-label"),
    importStatus: document.getElementById("import-status"),
    markSlot: document.getElementById("mark-slot"),
    logoFile: document.getElementById("logo-file"),
    logoUploadLabel: document.getElementById("logo-upload-label"),
    logoStatus: document.getElementById("logo-status"),
  };

  // ---- School logo (self-service, one-time upload) ----
  const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3MB - localStorage's quota is a few MB total

  function setLogoStatus(message, kind) {
    el.logoStatus.textContent = message || "";
    el.logoStatus.hidden = !message;
    el.logoStatus.classList.remove("error", "success");
    if (kind) el.logoStatus.classList.add(kind);
  }

  function showLogo(dataUrl) {
    el.markSlot.innerHTML = "";
    const img = document.createElement("img");
    img.className = "brand-logo";
    img.src = dataUrl;
    img.alt = "School logo";
    img.title = "Click to change logo";
    img.addEventListener("click", () => el.logoFile.click());
    el.markSlot.appendChild(img);
    el.logoUploadLabel.hidden = true;
    updateFavicon(dataUrl);
  }

  (function initLogo() {
    let saved = null;
    try {
      saved = localStorage.getItem(LOGO_STORAGE_KEY);
    } catch (err) {
      // Storage unavailable - fall through to the built-in default.
    }
    showLogo(saved || DEFAULT_LOGO_DATA_URL);
  })();

  el.logoFile.addEventListener("change", () => {
    const file = el.logoFile.files[0];
    el.logoFile.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoStatus("That image is too large - try one under 3 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      try {
        localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
      } catch (err) {
        setLogoStatus("Saved for this visit only - the image was too large to keep permanently.");
      }
      showLogo(dataUrl);
    };
    reader.onerror = () => setLogoStatus("Couldn't read that image file.", "error");
    reader.readAsDataURL(file);
  });

  // Snapshot of the built-in word bank, so "Reset to default" has something
  // to restore after an import mutates CATEGORIES_DATA in place.
  const DEFAULT_CATEGORIES_DATA = JSON.parse(JSON.stringify(CATEGORIES_DATA));
  const WORD_BANK_STORAGE_KEY = "kriah-word-bank";
  const state = { previewRole: "teacher", usingDefaultData: true };

  function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  el.date.value = todayIso();
  el.title.value = CATEGORIES_DATA.title;

  function updateHeaderMeta() {
    const totalWords = CATEGORIES_DATA.categories.reduce((sum, c) => sum + c.count, 0);
    el.headerMeta.textContent = `${CATEGORIES_DATA.categories.length} categories · ${totalWords} words`;
  }
  updateHeaderMeta();

  function renderCategoryList() {
    el.categoryList.innerHTML = "";
    for (const cat of CATEGORIES_DATA.categories) {
      // The section dividers describe this specific curriculum's known
      // structure, so only show them for the built-in word bank - an
      // imported spreadsheet's categories won't match that structure.
      if (state.usingDefaultData && GROUP_BREAKS[cat.order]) {
        const label = document.createElement("div");
        label.className = "group-label";
        label.textContent = GROUP_BREAKS[cat.order];
        el.categoryList.appendChild(label);
      }

      const item = document.createElement("div");
      item.className = "category-item";

      const row = document.createElement("label");
      row.className = "category-row";
      row.dataset.id = cat.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = cat.id;

      const name = document.createElement("span");
      name.className = "cat-name";
      name.textContent = cat.name;

      const count = document.createElement("span");
      count.className = "cat-count";
      count.textContent = `${cat.count} word${cat.count === 1 ? "" : "s"}`;

      const badge = document.createElement("span");
      badge.className = "cat-badge";
      badge.hidden = true;

      row.append(checkbox, name, count, badge);
      item.appendChild(row);

      // A limit only makes sense when there's more than one word to trim
      // down from - e.g. "Letters (3x)" has every letter 3 times, and a
      // teacher may only want to test some of them.
      if (cat.count > 1) {
        const limitRow = document.createElement("div");
        limitRow.className = "cat-limit-row";
        limitRow.hidden = true;

        const limitLabel = document.createElement("span");
        limitLabel.textContent = "Use only";

        const limitInput = document.createElement("input");
        limitInput.type = "number";
        limitInput.className = "cat-limit";
        limitInput.min = "1";
        limitInput.max = String(cat.count);
        limitInput.value = String(cat.count);
        limitInput.addEventListener("change", () => {
          let n = Math.round(Number(limitInput.value));
          if (!Number.isFinite(n) || n < 1) n = 1;
          if (n > cat.count) n = cat.count;
          limitInput.value = String(n);
        });

        const limitSuffix = document.createElement("span");
        limitSuffix.textContent = `of ${cat.count} words`;

        limitRow.append(limitLabel, limitInput, limitSuffix);
        item.appendChild(limitRow);

        checkbox.addEventListener("change", () => {
          limitRow.hidden = !checkbox.checked;
        });
      }

      el.categoryList.appendChild(item);
    }
  }

  /** Reads each checked category's "use only N" input (if any narrower
   * than its full word count) into a { categoryId: limit } map for
   * assemble(). Categories left at their full count are omitted, which
   * assemble() also treats as "use every word" - either way is fine. */
  function getCategoryLimits() {
    const limits = {};
    for (const item of el.categoryList.querySelectorAll(".category-item")) {
      const checkbox = item.querySelector("input[type=checkbox]");
      const limitInput = item.querySelector(".cat-limit");
      if (!checkbox.checked || !limitInput) continue;
      const n = Math.round(Number(limitInput.value));
      if (Number.isFinite(n) && n > 0) limits[checkbox.value] = n;
    }
    return limits;
  }

  function setImportStatus(message, kind) {
    el.importStatus.textContent = message || "";
    el.importStatus.classList.remove("error", "success");
    if (kind) el.importStatus.classList.add(kind);
  }

  /** Swaps in a new word bank (from an import or a reset), refreshing
   * everything that's derived from CATEGORIES_DATA. Mutates in place
   * rather than reassigning, since CATEGORIES_DATA is a `const` shared
   * with the assemble()/buildHtml() logic above. */
  function applyWordBank(data, { sourceName, persist } = {}) {
    CATEGORIES_DATA.title = data.title || CATEGORIES_DATA.title;
    CATEGORIES_DATA.categories = data.categories;
    state.usingDefaultData = !sourceName;

    el.sourceLabel.textContent = sourceName ? `Using: ${sourceName}` : "Using: Ganeinu Academy default";
    el.resetSource.hidden = !sourceName;

    updateHeaderMeta();
    renderCategoryList();
    el.downloadTeacher.disabled = true;
    el.downloadStudent.disabled = true;
    setStatus("");
    updatePreview();

    if (persist) {
      try {
        localStorage.setItem(WORD_BANK_STORAGE_KEY, JSON.stringify({ data, sourceName }));
      } catch (err) {
        // Storage full/unavailable (e.g. private browsing) - the import
        // still works for this page load, it just won't survive a reload.
      }
    }
  }

  // On load, prefer a word bank imported in an earlier session (saved to
  // this browser only) over the one built into the page.
  (function initWordBank() {
    try {
      const saved = localStorage.getItem(WORD_BANK_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.data && Array.isArray(parsed.data.categories) && parsed.data.categories.length) {
          applyWordBank(parsed.data, { sourceName: parsed.sourceName, persist: false });
          return;
        }
      }
    } catch (err) {
      // Corrupt/unreadable storage - fall through to the built-in word bank.
    }
    renderCategoryList();
  })();

  async function handleImportFile(file) {
    setImportStatus("Reading spreadsheet…");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
      const data = rowsToCategories(rows, { sourceSheet: sheetName, title: CATEGORIES_DATA.title });

      if (!data.categories.length) {
        throw new Error("No categories found - check the spreadsheet has headers in row 2 and words below them.");
      }

      applyWordBank(data, { sourceName: file.name, persist: true });
      setImportStatus(`Imported ${data.categories.length} categories from ${file.name}.`, "success");
    } catch (err) {
      setImportStatus(err.message || "Couldn't read that file.", "error");
    }
  }

  function getSelectedCategoryIds() {
    return Array.from(el.categoryList.querySelectorAll("input[type=checkbox]:checked")).map((cb) => cb.value);
  }

  function updateBadges() {
    let n = 0;
    for (const row of el.categoryList.querySelectorAll(".category-row")) {
      const checkbox = row.querySelector("input[type=checkbox]");
      const badge = row.querySelector(".cat-badge");
      if (checkbox.checked) {
        n += 1;
        badge.textContent = String(n);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }
    return n;
  }

  function getFormat() {
    return document.querySelector('input[name="format"]:checked').value;
  }

  function buildMeta() {
    return {
      title: el.title.value.trim() || undefined,
      studentName: el.studentName.value.trim(),
      date: el.date.value.trim(),
      columns: Number(el.columns.value) || 4,
      orientation: el.orientation.value === "landscape" ? "landscape" : "portrait",
    };
  }

  function setStatus(message, kind) {
    el.statusMessage.textContent = message || "";
    el.statusMessage.classList.remove("error", "success");
    if (kind) el.statusMessage.classList.add(kind);
  }

  function onSelectionChanged() {
    const count = updateBadges();
    el.downloadTeacher.disabled = !count;
    el.downloadStudent.disabled = !count;
    setStatus("");
    updatePreview();
  }

  function updatePreview() {
    const categoryIds = getSelectedCategoryIds();
    el.previewPage.classList.toggle("landscape", el.orientation.value === "landscape");

    if (categoryIds.length === 0) {
      el.previewFrame.hidden = true;
      el.previewPlaceholder.hidden = false;
      el.previewPlaceholder.textContent = "Select one or more categories to see a preview.";
      return;
    }

    try {
      const assembled = assemble(categoryIds, getCategoryLimits());
      const html = buildHtml({ role: state.previewRole, assembled, meta: buildMeta() });
      el.previewFrame.srcdoc = html;
      el.previewFrame.hidden = false;
      el.previewPlaceholder.hidden = true;
    } catch (err) {
      el.previewFrame.hidden = true;
      el.previewPlaceholder.hidden = false;
      el.previewPlaceholder.textContent = err.message || "Could not build preview.";
    }
  }

  function slugifyFilename(text) {
    return (
      String(text)
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "kriah-assessment"
    );
  }

  function filenameFor({ title, role, format, date }) {
    const base = slugifyFilename(title || "Kriah-Assessment");
    const roleTag = role === "teacher" ? "Teacher" : "Student";
    const dateTag = date ? `-${slugifyFilename(date)}` : "";
    return `${base}-${roleTag}${dateTag}.${format}`;
  }

  function printDocument(role) {
    const categoryIds = getSelectedCategoryIds();
    const assembled = assemble(categoryIds, getCategoryLimits());
    const meta = buildMeta();
    const html = buildHtml({ role, assembled, meta });

    const onLoad = () => {
      el.printFrame.removeEventListener("load", onLoad);
      el.printFrame.contentWindow.focus();
      el.printFrame.contentWindow.print();
    };
    el.printFrame.addEventListener("load", onLoad);
    el.printFrame.srcdoc = html;
  }

  async function downloadWord(role) {
    const categoryIds = getSelectedCategoryIds();
    const assembled = assemble(categoryIds, getCategoryLimits());
    const meta = buildMeta();
    const blob = await renderDocx({ role, assembled, meta });
    const filename = filenameFor({ title: meta.title, role, format: "docx", date: meta.date });

    // Published as a Claude Artifact, the page runs in a sandbox that
    // silently ignores plain <a download>/blob-URL saves - offering the
    // file has to go through this host-mediated save instead. Opened as a
    // plain file (or self-hosted), there is no window.claude, so fall back
    // to the normal browser download.
    if (window.claude && window.claude.downloads) {
      await window.claude.downloads.save({ filename, data: blob });
      return filename;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  }

  async function exportRole(role) {
    if (getSelectedCategoryIds().length === 0) return;
    const format = getFormat();
    const button = role === "teacher" ? el.downloadTeacher : el.downloadStudent;
    const originalText = button.textContent;
    button.disabled = true;
    setStatus("");

    try {
      if (format === "pdf") {
        button.textContent = "Opening print dialog…";
        printDocument(role);
        setStatus("Choose “Save as PDF” in the print dialog.", "success");
      } else {
        button.textContent = "Generating…";
        const filename = await downloadWord(role);
        setStatus(`Downloaded ${filename}`, "success");
      }
    } catch (err) {
      if (err && err.code === "declined") {
        setStatus("Download cancelled.");
      } else if (err && err.code === "extension_not_enabled") {
        setStatus("Word downloads aren't enabled in this view - try the PDF option instead.", "error");
      } else {
        setStatus((err && err.message) || "Something went wrong.", "error");
      }
    } finally {
      button.disabled = getSelectedCategoryIds().length === 0;
      button.textContent = originalText;
    }
  }

  el.categoryList.addEventListener("change", onSelectionChanged);
  el.selectAll.addEventListener("click", () => {
    el.categoryList.querySelectorAll("input[type=checkbox]").forEach((cb) => (cb.checked = true));
    onSelectionChanged();
  });
  el.clearAll.addEventListener("click", () => {
    el.categoryList.querySelectorAll("input[type=checkbox]").forEach((cb) => (cb.checked = false));
    onSelectionChanged();
  });
  el.downloadTeacher.addEventListener("click", () => exportRole("teacher"));
  el.downloadStudent.addEventListener("click", () => exportRole("student"));
  el.importFile.addEventListener("change", () => {
    const file = el.importFile.files[0];
    el.importFile.value = ""; // allow re-importing the same filename later
    if (file) handleImportFile(file);
  });
  el.resetSource.addEventListener("click", () => {
    localStorage.removeItem(WORD_BANK_STORAGE_KEY);
    applyWordBank(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES_DATA)));
    setImportStatus("Reset to the default word bank.", "success");
  });
  [el.title, el.studentName, el.date, el.columns].forEach((input) => input.addEventListener("input", updatePreview));
  el.orientation.addEventListener("change", updatePreview);
  document.querySelectorAll('input[name="format"]').forEach((r) =>
    r.addEventListener("change", () => {
      setStatus("");
      document.getElementById("format-hint").textContent =
        r.closest(".format-toggle").querySelector('input[value="pdf"]').checked
          ? 'PDF opens your browser’s print dialog — choose "Save as PDF" as the destination.'
          : "Word downloads directly as an editable .docx file.";
    })
  );
  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      el.tabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
      state.previewRole = tab.dataset.role;
      updatePreview();
    });
  });

  updatePreview();
})();
