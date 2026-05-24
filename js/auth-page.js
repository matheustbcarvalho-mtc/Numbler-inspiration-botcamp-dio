(function () {
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("redirect") || "index.html";

  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const formLogin = document.getElementById("form-login");
  const formSignup = document.getElementById("form-signup");
  const msgEl = document.getElementById("auth-message");
  const configWarn = document.getElementById("config-warn");

  function setMessage(text, type) {
    msgEl.textContent = text || "";
    msgEl.className = "auth-message" + (type ? ` ${type}` : "");
  }

  function setActiveTab(mode) {
    const isLogin = mode === "login";
    tabLogin.classList.toggle("active", isLogin);
    tabSignup.classList.toggle("active", !isLogin);
    formLogin.classList.toggle("hidden", !isLogin);
    formSignup.classList.toggle("hidden", isLogin);
    setMessage("");
  }

  tabLogin.addEventListener("click", () => setActiveTab("login"));
  tabSignup.addEventListener("click", () => setActiveTab("signup"));

  if (!SupabaseApp.isConfigured()) {
    configWarn?.classList.remove("hidden");
    document.querySelectorAll(".auth-submit").forEach((b) => {
      b.disabled = true;
    });
    setMessage("Configure config.js ou as variáveis na Vercel.", "info");
    return;
  }

  const supabase = SupabaseApp.getClient();

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      window.location.replace(redirectTo);
    }
  });

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = formLogin.querySelector(".auth-submit");
    btn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btn.disabled = false;

    if (error) {
      setMessage(translateError(error.message), "error");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      await upsertProfile(sessionData.session.user);
    }
    setMessage("Entrando…", "success");
    window.location.replace(redirectTo);
  }

  async function upsertProfile(user, displayNameOverride) {
    const name =
      displayNameOverride ||
      user.user_metadata?.display_name ||
      (user.email ? user.email.split("@")[0] : "Jogador");
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        display_name: name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  }

  async function handleSignup(e) {
    e.preventDefault();
    setMessage("");
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const displayName = document.getElementById("signup-name").value.trim();
    const btn = formSignup.querySelector(".auth-submit");
    btn.disabled = true;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
        emailRedirectTo: new URL(redirectTo, window.location.origin).href,
      },
    });
    btn.disabled = false;

    if (error) {
      setMessage(translateError(error.message), "error");
      return;
    }

    if (data.session) {
      await upsertProfile(data.session.user, displayName);
      setMessage("Conta criada! Redirecionando…", "success");
      window.location.replace(redirectTo);
      return;
    }

    setMessage(
      "Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.",
      "success"
    );
    setActiveTab("login");
  }

  function translateError(msg) {
    if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
    if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
    if (/password should be at least/i.test(msg)) return "A senha deve ter pelo menos 6 caracteres.";
    if (/user already registered/i.test(msg)) return "Este e-mail já está cadastrado.";
    return msg;
  }

  formLogin.addEventListener("submit", handleLogin);
  formSignup.addEventListener("submit", handleSignup);
})();
