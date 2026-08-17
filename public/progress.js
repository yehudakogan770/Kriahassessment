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
    assessSkill: document.getElementById("assess-skill"),
    assessDate: document.getElementById("assess-date"),
    assessNotes: document.getElementById("assess-notes"),
    logStatus: document.getElementById("log-status"),
    assessmentHistory: document.getElementById("assessment-history"),
  };

  const MASTERY_LABELS = {
    mastered: "Mastered",
    approaching: "Approaching Mastery",
    progressing: "Making Progress",
  };

  const state = { selectedStudentId: null };

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
    el.assessDate.value = todayIso();
    renderAssessmentHistory(assessments);
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
      entry.innerHTML = `
        <div class="assessment-head">
          <span class="assessment-skill">${escapeHtml(a.skill)}</span>
          <span class="mastery-badge ${a.mastery}">${MASTERY_LABELS[a.mastery] || a.mastery}</span>
          <span class="assessment-date">${escapeHtml(a.assessedOn)}</span>
        </div>
        ${a.notes ? `<p class="assessment-notes">${escapeHtml(a.notes)}</p>` : ""}
        <p class="assessment-by">Logged by ${escapeHtml(a.teacherName)}</p>
      `;
      el.assessmentHistory.appendChild(entry);
    }
  }

  el.logAssessmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el.logStatus, "");
    if (!state.selectedStudentId) return;

    const skill = el.assessSkill.value.trim();
    const mastery = el.logAssessmentForm.querySelector('input[name="mastery"]:checked')?.value;
    const assessedOn = el.assessDate.value;
    const notes = el.assessNotes.value.trim();

    try {
      const res = await fetch(`/api/progress/students/${state.selectedStudentId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, mastery, assessedOn, notes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not log assessment.");
      el.assessSkill.value = "";
      el.assessNotes.value = "";
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
