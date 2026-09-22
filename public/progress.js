(() => {
  const el = {
    authView: document.getElementById("auth-view"),
    appView: document.getElementById("app-view"),
    loginForm: document.getElementById("login-form"),
    signupForm: document.getElementById("signup-form"),
    loginStatus: document.getElementById("login-status"),
    signupStatus: document.getElementById("signup-status"),
    showSignup: document.getElementById("show-signup"),
    showLogin: document.getElementById("show-login"),
    toSignupWrap: document.getElementById("to-signup-wrap"),
    toLoginWrap: document.getElementById("to-login-wrap"),
    authHeading: document.getElementById("auth-heading"),
    teacherName: document.getElementById("teacher-name"),
    logoutBtn: document.getElementById("logout-btn"),

    addStudentForm: document.getElementById("add-student-form"),
    newStudentName: document.getElementById("new-student-name"),
    newStudentGrade: document.getElementById("new-student-grade"),
    addStudentStatus: document.getElementById("add-student-status"),
    studentList: document.getElementById("student-list"),

    studentDetailCard: document.getElementById("student-detail-card"),
    studentDetailName: document.getElementById("student-detail-name"),
    noStudentPlaceholder: document.getElementById("no-student-placeholder"),
    logAssessmentForm: document.getElementById("log-assessment-form"),
    assessCategory: document.getElementById("assess-category"),
    assessSkill: document.getElementById("assess-skill"),
    assessDate: document.getElementById("assess-date"),
    assessMisreadCount: document.getElementById("assess-misread-count"),
    fluencyCheckboxes: document.getElementById("fluency-checkboxes"),
    letterConfusionFields: document.getElementById("letter-confusion-fields"),
    vowelConfusionFields: document.getElementById("vowel-confusion-fields"),
    assessLookAlike: document.getElementById("assess-look-alike"),
    assessSoundAlike: document.getElementById("assess-sound-alike"),
    assessPhonemic: document.getElementById("assess-phonemic"),
    assessVowelName: document.getElementById("assess-vowel-name"),
    assessVowelSound: document.getElementById("assess-vowel-sound"),
    assessVowelBlend: document.getElementById("assess-vowel-blend"),
    assessNotes: document.getElementById("assess-notes"),
    assessNextStep: document.getElementById("assess-next-step"),
    logStatus: document.getElementById("log-status"),
    assessmentHistory: document.getElementById("assessment-history"),
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

  const state = {
    selectedStudentId: null,
    taxonomy: [],
    letterConfusionCategories: [],
    vowelConfusionCategories: [],
    fluencyNoteOptions: [],
  };

  function setStatus(node, message, kind) {
    node.textContent = message || "";
    node.classList.remove("error", "success");
    if (kind) node.classList.add(kind);
  }

  function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  // ---- Auth ----

  function showSignedIn(teacher) {
    el.authView.hidden = true;
    el.appView.hidden = false;
    el.teacherName.textContent = teacher.name;
    loadSkillTaxonomy();
    loadStudents();
  }

  function showAuth() {
    el.authView.hidden = false;
    el.appView.hidden = true;
    state.selectedStudentId = null;
  }

  el.showSignup.addEventListener("click", () => {
    el.loginForm.hidden = true;
    el.signupForm.hidden = false;
    el.toSignupWrap.hidden = true;
    el.toLoginWrap.hidden = false;
    el.authHeading.textContent = "Create Teacher Account";
  });
  el.showLogin.addEventListener("click", () => {
    el.loginForm.hidden = false;
    el.signupForm.hidden = true;
    el.toSignupWrap.hidden = false;
    el.toLoginWrap.hidden = true;
    el.authHeading.textContent = "Teacher Sign In";
  });

  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el.loginStatus, "");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Sign in failed.");
      showSignedIn(body.teacher);
    } catch (err) {
      setStatus(el.loginStatus, err.message, "error");
    }
  });

  el.signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el.signupStatus, "");
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create account.");
      showSignedIn(body.teacher);
    } catch (err) {
      setStatus(el.signupStatus, err.message, "error");
    }
  });

  el.logoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    showAuth();
  });

  // ---- Skill taxonomy ----

  async function loadSkillTaxonomy() {
    const res = await fetch("/api/progress/skills");
    if (!res.ok) return;
    const body = await res.json();
    state.taxonomy = body.taxonomy;
    state.letterConfusionCategories = body.letterConfusionCategories;
    state.vowelConfusionCategories = body.vowelConfusionCategories;
    state.fluencyNoteOptions = body.fluencyNoteOptions;

    el.assessCategory.innerHTML = state.taxonomy
      .map((c) => `<option value="${escapeHtml(c.category)}">${escapeHtml(c.category)}</option>`)
      .join("");
    el.fluencyCheckboxes.innerHTML = state.fluencyNoteOptions
      .map(
        (o) => `<label><input type="checkbox" name="fluency" value="${escapeHtml(o.id)}" /> ${escapeHtml(o.label)}</label>`
      )
      .join("");

    populateSkillsForCategory(el.assessCategory.value);
    updateConfusionFieldsVisibility(el.assessCategory.value);
  }

  function populateSkillsForCategory(category) {
    const cat = state.taxonomy.find((c) => c.category === category);
    const skills = cat ? cat.skills : [];
    el.assessSkill.innerHTML = skills
      .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
      .join("");
  }

  function updateConfusionFieldsVisibility(category) {
    el.letterConfusionFields.hidden = !state.letterConfusionCategories.includes(category);
    el.vowelConfusionFields.hidden = !state.vowelConfusionCategories.includes(category);
  }

  el.assessCategory.addEventListener("change", () => {
    populateSkillsForCategory(el.assessCategory.value);
    updateConfusionFieldsVisibility(el.assessCategory.value);
  });

  // ---- Students ----

  async function loadStudents() {
    const res = await fetch("/api/progress/students");
    if (!res.ok) return;
    const { students } = await res.json();
    renderStudentList(students);
  }

  function renderStudentList(students) {
    el.studentList.innerHTML = "";
    if (students.length === 0) {
      el.studentList.innerHTML = '<p class="empty-list">No students yet - add one above.</p>';
      return;
    }
    for (const s of students) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "student-row" + (s.id === state.selectedStudentId ? " active" : "");
      row.dataset.id = s.id;
      const meta = s.lastAssessedOn
        ? `${s.assessmentCount} assessment${s.assessmentCount === 1 ? "" : "s"} · last ${s.lastAssessedOn}`
        : "no assessments yet";
      row.innerHTML = `
        <span class="s-name">${escapeHtml(s.name)}</span>
        ${s.grade ? `<span class="s-grade">${escapeHtml(s.grade)}</span>` : ""}
        <span class="s-meta">${escapeHtml(meta)}</span>
      `;
      row.addEventListener("click", () => selectStudent(s.id));
      el.studentList.appendChild(row);
    }
  }

  el.addStudentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el.addStudentStatus, "");
    const name = el.newStudentName.value.trim();
    const grade = el.newStudentGrade.value.trim();
    try {
      const res = await fetch("/api/progress/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, grade }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not add student.");
      el.newStudentName.value = "";
      el.newStudentGrade.value = "";
      await loadStudents();
      selectStudent(body.student.id);
    } catch (err) {
      setStatus(el.addStudentStatus, err.message, "error");
    }
  });

  function resetAssessmentForm() {
    el.assessCategory.selectedIndex = 0;
    populateSkillsForCategory(el.assessCategory.value);
    updateConfusionFieldsVisibility(el.assessCategory.value);
    el.assessDate.value = todayIso();
    el.assessMisreadCount.value = "";
    el.fluencyCheckboxes.querySelectorAll("input").forEach((cb) => (cb.checked = false));
    el.assessLookAlike.value = "";
    el.assessSoundAlike.value = "";
    el.assessPhonemic.value = "";
    el.assessVowelName.value = "";
    el.assessVowelSound.value = "";
    el.assessVowelBlend.value = "";
    el.assessNotes.value = "";
    el.assessNextStep.value = "";
    el.logAssessmentForm.querySelector('input[name="mastery"][value="progressing"]').checked = true;
  }

  async function selectStudent(id) {
    state.selectedStudentId = id;
    el.studentList.querySelectorAll(".student-row").forEach((row) => {
      row.classList.toggle("active", Number(row.dataset.id) === id);
    });

    const res = await fetch(`/api/progress/students/${id}`);
    if (!res.ok) return;
    const { student, assessments } = await res.json();

    el.noStudentPlaceholder.hidden = true;
    el.studentDetailCard.hidden = false;
    el.studentDetailName.textContent = student.grade ? `${student.name} (${student.grade})` : student.name;
    resetAssessmentForm();
    renderAssessmentHistory(assessments);
  }

  function renderMistakeDetail(detail) {
    if (!detail) return "";
    const parts = Object.keys(MISTAKE_DETAIL_LABELS)
      .filter((key) => detail[key] !== undefined && detail[key] !== null && detail[key] !== "")
      .map((key) => `<strong>${escapeHtml(MISTAKE_DETAIL_LABELS[key])}:</strong> ${escapeHtml(detail[key])}`);
    return parts.length ? `<p class="assessment-notes">${parts.join(" &middot; ")}</p>` : "";
  }

  function renderAssessmentHistory(assessments) {
    el.assessmentHistory.innerHTML = "";
    if (assessments.length === 0) {
      el.assessmentHistory.innerHTML = '<p class="empty-list">No assessments logged yet.</p>';
      return;
    }
    for (const a of assessments) {
      const entry = document.createElement("div");
      entry.className = "assessment-entry";
      const fluencyLabels = (a.fluencyNotes || [])
        .map((id) => state.fluencyNoteOptions.find((o) => o.id === id)?.label || id)
        .join(", ");
      entry.innerHTML = `
        <div class="assessment-head">
          <span class="assessment-skill">${escapeHtml(a.category)} - ${escapeHtml(a.skill)}</span>
          <span class="mastery-badge ${a.mastery}">${MASTERY_LABELS[a.mastery] || a.mastery}</span>
          <span class="assessment-date">${escapeHtml(a.assessedOn)}</span>
        </div>
        ${fluencyLabels ? `<p class="assessment-notes"><strong>Fluency:</strong> ${escapeHtml(fluencyLabels)}</p>` : ""}
        ${renderMistakeDetail(a.mistakeDetail)}
        ${a.notes ? `<p class="assessment-notes">${escapeHtml(a.notes)}</p>` : ""}
        ${a.nextStep ? `<p class="assessment-notes"><strong>Next Step:</strong> ${escapeHtml(a.nextStep)}</p>` : ""}
        <p class="assessment-by">Logged by ${escapeHtml(a.teacherName)}</p>
      `;
      el.assessmentHistory.appendChild(entry);
    }
  }

  el.logAssessmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el.logStatus, "");
    if (!state.selectedStudentId) return;

    const category = el.assessCategory.value;
    const skill = el.assessSkill.value;
    const mastery = el.logAssessmentForm.querySelector('input[name="mastery"]:checked')?.value;
    const assessedOn = el.assessDate.value;
    const notes = el.assessNotes.value.trim();
    const nextStep = el.assessNextStep.value.trim();
    const fluencyNotes = Array.from(el.fluencyCheckboxes.querySelectorAll("input:checked")).map((cb) => cb.value);
    const mistakeDetail = {
      misreadCount: el.assessMisreadCount.value === "" ? undefined : Number(el.assessMisreadCount.value),
      lookAlikeLetters: el.assessLookAlike.value.trim(),
      soundAlikeLetters: el.assessSoundAlike.value.trim(),
      phonemicMixups: el.assessPhonemic.value.trim(),
      vowelNameConfusion: el.assessVowelName.value.trim(),
      vowelSoundConfusion: el.assessVowelSound.value.trim(),
      vowelBlendingConfusion: el.assessVowelBlend.value.trim(),
    };

    try {
      const res = await fetch(`/api/progress/students/${state.selectedStudentId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, skill, mastery, assessedOn, notes, nextStep, fluencyNotes, mistakeDetail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not log assessment.");
      setStatus(el.logStatus, "Logged.", "success");
      await loadStudents();
      await selectStudent(state.selectedStudentId);
    } catch (err) {
      setStatus(el.logStatus, err.message, "error");
    }
  });

  (async function init() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const body = await res.json();
        showSignedIn(body.teacher);
        return;
      }
    } catch (err) {
      // fall through to showing the sign-in form
    }
    showAuth();
  })();
})();
