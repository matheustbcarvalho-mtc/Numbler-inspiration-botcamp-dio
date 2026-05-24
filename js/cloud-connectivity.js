/** Indicador NUVEM — Supabase configurado e sessão estável (sem sumir a cada giro). */
(function () {
  const LABEL_ON = "NUVEM";
  let online = false;
  let sessionLatched = false;

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
      online = true;
    } else {
      badge.classList.add("hidden");
      badge.classList.remove("cloud-online-badge--session");
      badge.removeAttribute("title");
      badge.removeAttribute("aria-label");
      online = false;
    }
  }

  function markSessionActive() {
    sessionLatched = true;
    setBadge(true, {
      label: LABEL_ON,
      hasSession: true,
      title: "Supabase online — sessão ativa",
    });
  }

  async function pingSupabaseApi() {
    if (!window.SupabaseApp?.isConfigured?.()) return false;

    const base = (window.SUPABASE_URL || "").replace(/\/$/, "");
    const key = window.SUPABASE_ANON_KEY || "";
    if (!base || !key) return false;

    try {
      const res = await fetch(`${base}/auth/v1/health`, {
        method: "GET",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) return true;
    } catch {
      /* fallback abaixo */
    }

    const supabase = SupabaseApp.getClient();
    if (!supabase) return false;
    try {
      const { error } = await supabase.auth.getSession();
      return !error;
    } catch {
      return false;
    }
  }

  async function hasValidUserSession(supabase) {
    try {
      const { data, error } = await supabase.auth.getUser();
      return !error && Boolean(data?.user);
    } catch {
      return false;
    }
  }

  /**
   * @param {{ requireSession?: boolean }} options
   */
  async function refresh(options = {}) {
    const { requireSession = false } = options;

    if (!SupabaseApp?.isConfigured?.()) {
      sessionLatched = false;
      setBadge(false);
      return false;
    }

    const supabase = SupabaseApp.getClient();
    if (!supabase) {
      if (sessionLatched && requireSession && window.GameAuth?.getUserId?.()) {
        markSessionActive();
        return true;
      }
      setBadge(false);
      return false;
    }

    let apiOk = await pingSupabaseApi();
    let hasSession = false;

    if (requireSession) {
      hasSession = await hasValidUserSession(supabase);
      if (hasSession) {
        sessionLatched = true;
        apiOk = true;
      } else if (sessionLatched && window.GameAuth?.getUserId?.()) {
        hasSession = true;
        apiOk = true;
      } else {
        apiOk = false;
      }
    } else {
      const { data } = await supabase.auth.getSession();
      hasSession = Boolean(data?.session);
      if (hasSession) sessionLatched = true;
    }

    if (apiOk) {
      setBadge(true, {
        label: LABEL_ON,
        hasSession: requireSession ? hasSession : hasSession || sessionLatched,
        title: hasSession
          ? "Supabase online — sessão ativa"
          : "Supabase online — faça login para sincronizar",
      });
    } else if (!requireSession) {
      setBadge(false);
    } else if (sessionLatched) {
      markSessionActive();
      return true;
    } else {
      setBadge(false);
    }

    return apiOk;
  }

  window.CloudConnectivity = {
    refresh,
    markSessionActive,
    isOnline: () => online,
    setBadge,
    LABEL_ON,
  };
})();
