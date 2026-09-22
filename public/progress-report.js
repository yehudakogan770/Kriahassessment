(() => {
  const el = {
    gradeSelect: document.getElementById("grade-select"),
    reportStatus: document.getElementById("report-status"),
    reportBody: document.getElementById("report-body"),
  };

  const MASTERY_LABELS = {
    mastered: "Mastered",
    approaching: "Approaching Mastery",
    progressing: "Making Progress",
  };

  const MISTAKE_DETAIL_LABELS = {
    misreadCount: "Misread",
    lookAlikeLetters: "Look-alike letters",
    soundAlikeLetters: "Sound-alike letters",
    phonemicMixups: "Phonemic mix-ups",
    vowelNameConfusion: "Vowel name confusion",
    vowelSoundConfusion: "Vowel sound confusion",
    vowelBlendingConfusion: "Vowel-letter blending confusion",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function setStatus(message, kind) {
    el.reportStatus.textContent = message || "";
    el.reportStatus.classList.remove("error", "success");
    if (kind) el.reportStatus.classList.add(kind);
  }

  function getViewMode() {
    return document.querySelector('input[name="view-mode"]:checked').value;
  }
  function getMetricMode() {
    return document.querySelector('input[name="metric-mode"]:checked').value;
  }

  async function loadClasses() {
    const res = await fetch("/api/progress/classes");
    if (!res.ok) return;
    const { grades } = await res.json();
    for (const g of grades) {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      el.gradeSelect.appendChild(opt);
    }
  }

  function renderSkillChip(entry, metric) {
    if (metric === "fluency") {
      if (entry.durationSeconds == null) {
        return `<span class="skill-chip timing"><span class="chip-skill">${escapeHtml(entry.skill)}</span><span class="chip-meta">no timing recorded</span></span>`;
      }
      const bits = [`Took ${formatDuration(entry.durationSeconds)}`];
      if (entry.classAvgSeconds != null) bits.push(`class ${formatDuration(entry.classAvgSeconds)}`);
      if (entry.schoolAvgSeconds != null) bits.push(`school ${formatDuration(entry.schoolAvgSeconds)}`);
      return `<span class="skill-chip timing"><span class="chip-skill">${escapeHtml(entry.skill)}</span><span class="chip-meta">${escapeHtml(bits.join(" · "))}</span></span>`;
    }
    return `<span class="skill-chip ${entry.mastery}"><span class="chip-skill">${escapeHtml(entry.skill)}</span><span class="chip-meta">${escapeHtml(MASTERY_LABELS[entry.mastery] || entry.mastery)}</span></span>`;
  }

  function renderMistakeDetail(detail) {
    if (!detail) return "";
    const parts = Object.keys(MISTAKE_DETAIL_LABELS)
      .filter((key) => detail[key] !== undefined && detail[key] !== null && detail[key] !== "")
      .map((key) => `<strong>${escapeHtml(MISTAKE_DETAIL_LABELS[key])}:</strong> ${escapeHtml(detail[key])}`);
    return parts.length ? `<p class="assessment-notes">${parts.join(" &middot; ")}</p>` : "";
  }

  function renderFluencyTiming(a) {
    if (a.durationSeconds == null) return "";
    const parts = [`Took ${formatDuration(a.durationSeconds)}`];
    if (a.classAvgSeconds != null) parts.push(`Class avg ${formatDuration(a.classAvgSeconds)} (n=${a.classCount})`);
    if (a.schoolAvgSeconds != null) parts.push(`School avg ${formatDuration(a.schoolAvgSeconds)} (n=${a.schoolCount})`);
    return `<p class="assessment-notes">${escapeHtml(parts.join(" · "))}</p>`;
  }

  function renderDetailedEntry(a) {
    const fluencyLabels = (a.fluencyNotes || []).join(", ");
    return `
      <div class="assessment-entry">
        <div class="assessment-head">
          <span class="assessment-skill">${escapeHtml(a.category)} - ${escapeHtml(a.skill)}</span>
          <span class="mastery-badge ${a.mastery}">${MASTERY_LABELS[a.mastery] || a.mastery}</span>
          <span class="assessment-date">${escapeHtml(a.assessedOn)}</span>
        </div>
        ${renderFluencyTiming(a)}
        ${fluencyLabels ? `<p class="assessment-notes"><strong>Fluency:</strong> ${escapeHtml(fluencyLabels)}</p>` : ""}
        ${renderMistakeDetail(a.mistakeDetail)}
        ${a.notes ? `<p class="assessment-notes">${escapeHtml(a.notes)}</p>` : ""}
        ${a.nextStep ? `<p class="assessment-notes"><strong>Next Step:</strong> ${escapeHtml(a.nextStep)}</p>` : ""}
        <p class="assessment-by">Logged by ${escapeHtml(a.teacherName)}</p>
      </div>`;
  }

  function renderReport(report, viewMode, metricMode) {
    el.reportBody.innerHTML = "";
    if (report.length === 0) {
      el.reportBody.innerHTML = '<p class="empty-list">No students in this class yet.</p>';
      return;
    }
    for (const { student, latestBySkill, assessments } of report) {
      const card = document.createElement("div");
      card.className = "card student-report-card";
      const count = assessments.length;
      const head = `
        <div class="student-report-head">
          <h3>${escapeHtml(student.name)}</h3>
          ${student.grade ? `<span class="s-grade">${escapeHtml(student.grade)}</span>` : ""}
          <span class="s-count">${count} assessment${count === 1 ? "" : "s"}</span>
        </div>`;

      let body;
      if (viewMode === "detailed") {
        body = assessments.length
          ? assessments.map(renderDetailedEntry).join("")
          : '<p class="empty-list">No assessments logged yet.</p>';
      } else {
        body = latestBySkill.length
          ? `<div class="skill-chip-row">${latestBySkill.map((e) => renderSkillChip(e, metricMode)).join("")}</div>`
          : '<p class="empty-list">No assessments logged yet.</p>';
      }

      card.innerHTML = head + body;
      el.reportBody.appendChild(card);
    }
  }

  async function loadReport() {
    setStatus("Loading…");
    const grade = el.gradeSelect.value;
    try {
      const res = await fetch(`/api/progress/report${grade ? `?grade=${encodeURIComponent(grade)}` : ""}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "progress.html";
          return;
        }
        throw new Error("Could not load report.");
      }
      const { report } = await res.json();
      renderReport(report, getViewMode(), getMetricMode());
      setStatus("");
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  el.gradeSelect.addEventListener("change", loadReport);
  document.querySelectorAll('input[name="view-mode"], input[name="metric-mode"]').forEach((input) =>
    input.addEventListener("change", loadReport)
  );

  (async function init() {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      window.location.href = "progress.html";
      return;
    }
    await loadClasses();
    await loadReport();
  })();
})();
