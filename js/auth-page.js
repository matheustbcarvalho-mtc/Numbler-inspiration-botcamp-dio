(function () {
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("redirect") || "index.html";
  const authError = params.get("error");

  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const formLogin = document.getElementById("form-login");
  const formSignup = document.getElementById("form-signup");
  const msgEl = document.getElementById("auth-message");
  const configWarn = document.getElementById("config-warn");

  const ERROR_MESSAGES = {
    not_dealer: "Acesso restrito. Somente dealers autorizados podem entrar.",
    config: "Aplicação não configurada. Defina as variáveis Supabase na Vercel.",
  };

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

  if (authError && ERROR_MESSAGES[authError]) {
    setMessage(ERROR_MESSAGES[authError], "error");
  }

  const dealerCodeInput = document.getElementById("signup-dealer-code");
  const dealerCodeField = document.getElementById("signup-dealer-code-field");
  if ((window.DEALER_SIGNUP_CODE || "").trim()) {
    dealerCodeInput?.setAttribute("required", "required");
  } else {
    dealerCodeField?.classList.add("hidden");
  }

  if (!SupabaseApp.isConfigured()) {
    configWarn?.classList.remove("hidden");
    document.querySelectorAll(".auth-submit").forEach((b) => {
      b.disabled = true;
    });
    setMessage("Configure config.js ou as variáveis na Vercel.", "info");
    return;
  }

  const supabase = SupabaseApp.getClient();

  supabase.auth.getSession().then(async ({ data }) => {
    if (!data.session) return;
    const ok = await DealerAccess.userIsDealer(supabase, data.session.user.id);
    if (ok) window.location.replace(redirectTo);
    else await DealerAccess.denyAndRedirectToLogin(supabase, "not_dealer");
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
    const user = sessionData.session?.user;
    if (!user) return;

    const isDealer = await DealerAccess.userIsDealer(supabase, user.id);
    if (!isDealer) {
      await DealerAccess.denyAndRedirectToLogin(supabase, "not_dealer");
      return;
    }

    await upsertProfile(user);
    setMessage("Entrando…", "success");
    window.location.replace(redirectTo);
  }

  async function upsertProfile(user, displayNameOverride, role) {
    const name =
      displayNameOverride ||
      user.user_metadata?.display_name ||
      (user.email ? user.email.split("@")[0] : "Jogador");
    const row = {
      id: user.id,
      email: user.email,
      display_name: name,
      updated_at: new Date().toISOString(),
    };
    if (role) row.role = role;
    await supabase.from("profiles").upsert(row, { onConflict: "id" });
  }

  async function handleSignup(e) {
    e.preventDefault();
    setMessage("");
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const displayName = document.getElementById("signup-name").value.trim();
    const dealerCode = document.getElementById("signup-dealer-code")?.value?.trim() || "";
    const btn = formSignup.querySelector(".auth-submit");
    btn.disabled = true;

    let role = "player";
    if (DealerAccess.canAssignDealerOnSignup(dealerCode)) {
      role = "dealer";
    } else if ((window.DEALER_SIGNUP_CODE || "").trim()) {
      btn.disabled = false;
      setMessage("Código de dealer inválido. Contate o administrador.", "error");
      return;
    }

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
      await upsertProfile(data.session.user, displayName, role);
      if (role !== "dealer") {
        await DealerAccess.denyAndRedirectToLogin(supabase, "not_dealer");
        return;
      }
      setMessage("Conta criada! Redirecionando…", "success");
      window.location.replace(redirectTo);
      return;
    }

    if (role === "dealer" && data.user) {
      await upsertProfile(data.user, displayName, "dealer");
    }

    setMessage(
      role === "dealer"
        ? "Conta dealer criada! Confirme o e-mail e faça login."
        : "Conta criada, mas sem perfil dealer. Peça liberação ao administrador.",
      role === "dealer" ? "success" : "info"
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
