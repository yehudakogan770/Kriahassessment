(() => {
  const state = {
    categories: [],
    previewRole: "teacher",
  };

  const el = {
    title: document.getElementById("doc-title"),
    studentName: document.getElementById("student-name"),
    date: document.getElementById("doc-date"),
    columns: document.getElementById("columns"),
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

  function renderCategoryList() {
    el.categoryList.innerHTML = "";
    for (const cat of state.categories) {
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
      date: el.date.value.trim(),
      columns: Number(el.columns.value) || 3,
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
        body: JSON.stringify({ categoryIds, role: state.previewRole, ...buildMeta() }),
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
        body: JSON.stringify({ categoryIds, role, format, ...buildMeta() }),
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
  [el.title, el.studentName, el.date, el.columns].forEach((input) =>
    input.addEventListener("input", schedulePreviewUpdate)
  );
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
