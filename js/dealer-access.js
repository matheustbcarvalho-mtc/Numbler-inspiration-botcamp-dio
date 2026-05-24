/** Papéis: dealer (histórico de todos) vs player (só o próprio). Login aceita ambos. */
(function () {
  const DEALER_ROLE = "dealer";
  /** Fallback se config.js do deploy não tiver DEALER_SCATTER_BUY_EMAILS. */
  const BUILTIN_SCATTER_BUY_EMAILS = ["matheus.tbcarvalho@gmail.com"];

  function isConfigured() {
    return typeof SupabaseApp !== "undefined" && SupabaseApp.isConfigured();
  }

  function mustLockSite() {
    if (window.REQUIRE_DEALER_ACCESS === true) return true;
    return /vercel\.app$/i.test(window.location.hostname);
  }

  async function fetchRole(supabase, userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Erro ao verificar perfil:", error.message);
      return null;
    }
    return data?.role || "player";
  }

  function isDealerRole(role) {
    return role === DEALER_ROLE;
  }

  function emailHasScatterBuyAccess(email) {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    const lists = [window.DEALER_SCATTER_BUY_EMAILS, BUILTIN_SCATTER_BUY_EMAILS];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      if (list.some((e) => String(e).trim().toLowerCase() === normalized)) return true;
    }
    return false;
  }

  function metadataSaysDealer(user) {
    const role = user?.user_metadata?.role || user?.app_metadata?.role;
    return role === DEALER_ROLE;
  }

  async function userIsDealer(supabase, userId, userHint) {
    const role = await fetchRole(supabase, userId);
    if (isDealerRole(role)) return true;

    let user = userHint;
    if (!user && supabase.auth?.getUser) {
      const { data } = await supabase.auth.getUser();
      user = data?.user;
    }
    if (metadataSaysDealer(user)) return true;
    if (emailHasScatterBuyAccess(user?.email || "")) return true;
    return false;
  }

  async function denyAndRedirectToLogin(supabase, reason) {
    if (supabase) await supabase.auth.signOut();
    const q = reason ? `?error=${encodeURIComponent(reason)}` : "";
    window.location.replace(`login.html${q}`);
  }

  window.DealerAccess = {
    DEALER_ROLE,
    mustLockSite,
    isConfigured,
    fetchRole,
    isDealerRole,
    metadataSaysDealer,
    emailHasScatterBuyAccess,
    userIsDealer,
    denyAndRedirectToLogin,
    signupCodeMatches(input) {
      const expected = (window.DEALER_SIGNUP_CODE || "").trim();
      if (!expected) return false;
      return input.trim() === expected;
    },
    canAssignDealerOnSignup(input) {
      const expected = (window.DEALER_SIGNUP_CODE || "").trim();
      if (!expected) return false;
      return input.trim() === expected;
    },
  };
})();
