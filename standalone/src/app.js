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

  const state = { previewRole: "teacher" };

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
  };

  function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  el.date.value = todayIso();
  el.title.value = CATEGORIES_DATA.title;

  const totalWords = CATEGORIES_DATA.categories.reduce((sum, c) => sum + c.count, 0);
  el.headerMeta.textContent = `${CATEGORIES_DATA.categories.length} categories · ${totalWords} words`;

  function renderCategoryList() {
    el.categoryList.innerHTML = "";
    for (const cat of CATEGORIES_DATA.categories) {
      if (GROUP_BREAKS[cat.order]) {
        const label = document.createElement("div");
        label.className = "group-label";
        label.textContent = GROUP_BREAKS[cat.order];
        el.categoryList.appendChild(label);
      }

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
      el.categoryList.appendChild(row);
    }
  }
  renderCategoryList();

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
      const assembled = assemble(categoryIds);
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
    const assembled = assemble(categoryIds);
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
    const assembled = assemble(categoryIds);
    const meta = buildMeta();
    const blob = await renderDocx({ role, assembled, meta });
    const filename = filenameFor({ title: meta.title, role, format: "docx", date: meta.date });

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
      setStatus(err.message || "Something went wrong.", "error");
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
