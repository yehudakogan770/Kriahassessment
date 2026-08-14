(() => {
  const state = {
    categories: [],
    previewRole: "teacher",
  };

  // Groups the category picker into collapsible sections matching the
  // curriculum's own skill areas, keyed by each category's id. Mirrors the
  // same table in standalone/src/app.js.
  const CATEGORY_GROUP_ORDER = ["Letters", "Vowels", "Vowel - Letter Blend", "Exception Rules", "Sheva Rules"];
  const CATEGORY_GROUPS = {
    "c01-letters-3x": "Letters",
    "c02-nekudot": "Vowels",
    "c03-basic-dotted-letters": "Vowel - Letter Blend",
    "c29-nekudot-letter-blend": "Vowel - Letter Blend",
    "c04-silent-letters-alef": "Exception Rules",
    "c05-silent-letters-yud": "Exception Rules",
    "c06-silent-letters-vav": "Exception Rules",
    "c07-yud-vav-ending": "Exception Rules",
    "c08-sheva-in-begining": "Sheva Rules",
    "c09-sheva-in-middle": "Sheva Rules",
    "c10-g2-sheva-in-middle-under": "Sheva Rules",
    "c11-shva-in-end": "Sheva Rules",
    "c12-2-shva-at-the-end": "Sheva Rules",
    "c13-shva-under-dagesh": "Sheva Rules",
    "c14-g2-sheva-after-shuruk-in-beg": "Sheva Rules",
    "c15-g2-sheva-after-sheva": "Sheva Rules",
    "c16-g2-sheva-under-twin-letters": "Sheva Rules",
    "c17-shuruk-in-begining": "Sheva Rules",
    "c18-confusing-dagesh-vav-vs-shuruk": "Exception Rules",
    "c19-confusing-dagesh-shared-nekudah-dot-shin-sin": "Exception Rules",
    "c20-confusing-dagesh-vav-vs-cholam-g2": "Exception Rules",
    "c21-shared-dot": "Exception Rules",
    "c22-kamatz-yud-ending": "Exception Rules",
    "c23-patach-yud-ending": "Exception Rules",
    "c24-silent-letter-and-yud-endings-g2": "Exception Rules",
    "c25-shuruk-yud-ending-g2": "Exception Rules",
    "c26-patach-genuvah-chet-g2": "Exception Rules",
    "c27-patach-genuvah-hey-g2": "Exception Rules",
    "c28-mapik-hey-hey-endings-g2": "Exception Rules",
    "c30-cholam-yud-ending-g2": "Exception Rules",
  };

  const el = {
    title: document.getElementById("doc-title"),
    studentName: document.getElementById("student-name"),
    grade: document.getElementById("student-grade"),
    date: document.getElementById("doc-date"),
    showDate: document.getElementById("show-date"),
    columns: document.getElementById("columns"),
    orientation: document.getElementById("orientation"),
    categoryList: document.getElementById("category-list"),
    selectAll: document.getElementById("select-all"),
    clearAll: document.getElementById("clear-all"),
    downloadTeacher: document.getElementById("download-teacher"),
    downloadStudent: document.getElementById("download-student"),
    statusMessage: document.getElementById("status-message"),
    previewFrame: document.getElementById("preview-frame"),
    previewPlaceholder: document.getElementById("preview-placeholder"),
    tabs: Array.from(document.querySelectorAll(".preview-tabs .tab")),
  };

  // A short code shown on both the Teacher and Student copy so they can be
  // paired back up, and sent to the server as the word-shuffle seed (see
  // assemble()'s matchCode param server-side) so switching preview tabs or
  // downloading Teacher then Student for the *same* selection always shows
  // the same word order. Only regenerated when the selection actually
  // changes. Mirrors generateMatchCode() in server/lib/assemble.js.
  const MATCH_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function generateMatchCode() {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += MATCH_CODE_ALPHABET[Math.floor(Math.random() * MATCH_CODE_ALPHABET.length)];
    }
    return code;
  }
  let matchCodeCache = null; // { signature, code }
  function getMatchCode(categoryIds) {
    const signature = JSON.stringify(categoryIds);
    if (!matchCodeCache || matchCodeCache.signature !== signature) {
      matchCodeCache = { signature, code: generateMatchCode() };
    }
    return matchCodeCache.code;
  }

  function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  el.date.value = todayIso();

  async function loadCategories() {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new Error("Failed to load categories");
    const data = await res.json();
    state.categories = data.categories;
    el.title.value = data.title;
    renderCategoryList();
  }

  function buildCategoryRow(cat) {
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
    return row;
  }

  function renderCategoryList() {
    el.categoryList.innerHTML = "";

    const byGroup = new Map(CATEGORY_GROUP_ORDER.map((name) => [name, []]));
    let anyUnmapped = false;
    for (const cat of state.categories) {
      const groupName = CATEGORY_GROUPS[cat.id];
      if (byGroup.has(groupName)) byGroup.get(groupName).push(cat);
      else anyUnmapped = true;
    }

    // A category outside the known id list (e.g. the taxonomy has drifted
    // from the word bank) means grouping can't be trusted - fall back to
    // one flat list rather than silently dropping categories.
    if (anyUnmapped) {
      for (const cat of state.categories) {
        el.categoryList.appendChild(buildCategoryRow(cat));
      }
      return;
    }

    for (const [groupName, cats] of byGroup) {
      if (cats.length === 0) continue;

      const details = document.createElement("details");
      details.className = "cat-group";

      const summary = document.createElement("summary");
      summary.className = "cat-group-summary";

      const summaryName = document.createElement("span");
      summaryName.className = "cat-group-name";
      summaryName.textContent = groupName;

      const summaryCount = document.createElement("span");
      summaryCount.className = "cat-group-count";
      summaryCount.textContent = `${cats.length} categor${cats.length === 1 ? "y" : "ies"}`;

      summary.append(summaryName, summaryCount);
      details.appendChild(summary);

      const body = document.createElement("div");
      body.className = "cat-group-body";
      for (const cat of cats) body.appendChild(buildCategoryRow(cat));
      details.appendChild(body);

      el.categoryList.appendChild(details);
    }
  }

  function getSelectedCategoryIds() {
    return Array.from(el.categoryList.querySelectorAll("input[type=checkbox]:checked")).map(
      (cb) => cb.value
    );
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
      grade: el.grade.value.trim(),
      date: el.date.value.trim(),
      hideDate: !el.showDate.checked,
      columns: Number(el.columns.value) || 3,
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
    const hasSelection = count > 0;
    el.downloadTeacher.disabled = !hasSelection;
    el.downloadStudent.disabled = !hasSelection;
    setStatus("");
    schedulePreviewUpdate();
  }

  let previewTimer = null;
  function schedulePreviewUpdate() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 350);
  }

  let previewRequestId = 0;
  async function updatePreview() {
    const categoryIds = getSelectedCategoryIds();
    if (categoryIds.length === 0) {
      el.previewFrame.hidden = true;
      el.previewPlaceholder.hidden = false;
      el.previewPlaceholder.textContent = "Select one or more categories to see a preview.";
      return;
    }

    const requestId = ++previewRequestId;
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds,
          role: state.previewRole,
          matchCode: getMatchCode(categoryIds),
          ...buildMeta(),
        }),
      });
      if (requestId !== previewRequestId) return; // a newer request superseded this one
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Preview failed");
      }
      const html = await res.text();
      el.previewFrame.srcdoc = html;
      el.previewFrame.hidden = false;
      el.previewPlaceholder.hidden = true;
    } catch (err) {
      if (requestId !== previewRequestId) return;
      el.previewFrame.hidden = true;
      el.previewPlaceholder.hidden = false;
      el.previewPlaceholder.textContent = err.message || "Could not build preview.";
    }
  }

  function parseFilename(contentDisposition, fallback) {
    if (!contentDisposition) return fallback;
    const match = /filename="?([^"]+)"?/.exec(contentDisposition);
    return match ? match[1] : fallback;
  }

  async function download(role) {
    const categoryIds = getSelectedCategoryIds();
    if (categoryIds.length === 0) return;

    const format = getFormat();
    const button = role === "teacher" ? el.downloadTeacher : el.downloadStudent;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Generating…";
    setStatus("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds,
          role,
          format,
          matchCode: getMatchCode(categoryIds),
          ...buildMeta(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Generation failed");
      }
      const blob = await res.blob();
      const filename = parseFilename(
        res.headers.get("Content-Disposition"),
        `kriah-assessment-${role}.${format}`
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${filename}`, "success");
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
  el.downloadTeacher.addEventListener("click", () => download("teacher"));
  el.downloadStudent.addEventListener("click", () => download("student"));
  [el.title, el.studentName, el.grade, el.date, el.columns].forEach((input) =>
    input.addEventListener("input", schedulePreviewUpdate)
  );
  el.orientation.addEventListener("change", schedulePreviewUpdate);
  el.showDate.addEventListener("change", schedulePreviewUpdate);
  document.querySelectorAll('input[name="format"]').forEach((r) =>
    r.addEventListener("change", () => setStatus(""))
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

  loadCategories().catch((err) => {
    el.categoryList.innerHTML = `<p class="loading">Failed to load categories: ${err.message}</p>`;
  });
})();
