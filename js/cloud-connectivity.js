/** Indicador NUVEM — Supabase configurado e API acessível. */
(function () {
  const LABEL_ON = "NUVEM";
  let online = false;

  function getBadge() {
    return document.getElementById("cloud-online-badge");
  }

  function setBadge(visible, options = {}) {
    const badge = getBadge();
    if (!badge) return;
    if (visible) {
      badge.textContent = options.label || LABEL_ON;
      badge.classList.remove("hidden");
      badge.classList.toggle("cloud-online-badge--session", Boolean(options.hasSession));
      badge.title = options.title || "Supabase conectado — nuvem online";
      badge.setAttribute("aria-label", badge.title);
    } else {
      badge.classList.add("hidden");
      badge.classList.remove("cloud-online-badge--session");
      badge.removeAttribute("title");
      badge.removeAttribute("aria-label");
    }
  }

  async function pingSupabaseApi() {
    if (!window.SupabaseApp?.isConfigured?.()) return false;

    const supabase = SupabaseApp.getClient();
    if (!supabase) return false;

    const base = (window.SUPABASE_URL || "").replace(/\/$/, "");
    const key = window.SUPABASE_ANON_KEY || "";
    if (!base || !key) return false;

    try {
      const res = await fetch(`${base}/auth/v1/health`, {
        method: "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });
      if (res.ok) return true;
    } catch {
      /* tenta fallback */
    }

    try {
      const { error } = await supabase.auth.getSession();
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * @param {{ requireSession?: boolean }} options
   * requireSession=false → login (só API/config)
   * requireSession=true  → jogo (precisa estar logado)
   */
  async function refresh(options = {}) {
    const { requireSession = false } = options;

    if (!SupabaseApp?.isConfigured?.()) {
      online = false;
      setBadge(false);
      return false;
    }

    let apiOk = await pingSupabaseApi();
    let hasSession = false;

    if (apiOk && requireSession) {
      const supabase = SupabaseApp.getClient();
      const { data, error } = await supabase.auth.getSession();
      hasSession = !error && Boolean(data?.session);
      apiOk = hasSession;
    } else if (apiOk && !requireSession) {
      const supabase = SupabaseApp.getClient();
      const { data } = await supabase.auth.getSession();
      hasSession = Boolean(data?.session);
    }

    online = apiOk;
    setBadge(apiOk, {
      label: LABEL_ON,
      hasSession,
      title: hasSession
        ? "Supabase online — sessão ativa"
        : "Supabase online — faça login para sincronizar",
    });
    return apiOk;
  }

  window.CloudConnectivity = {
    refresh,
    isOnline: () => online,
    setBadge,
    LABEL_ON,
  };
})();
