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
  };

  function setStatus(node, message, kind) {
    node.textContent = message || "";
    node.classList.remove("error", "success");
    if (kind) node.classList.add(kind);
  }

  function showSignedIn(teacher) {
    el.authView.hidden = true;
    el.appView.hidden = false;
    el.teacherName.textContent = teacher.name;
  }

  function showAuth() {
    el.authView.hidden = false;
    el.appView.hidden = true;
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
