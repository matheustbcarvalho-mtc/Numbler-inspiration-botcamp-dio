/** Controle de acesso: somente perfil role = dealer. */
(function () {
  const DEALER_ROLE = "dealer";

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

  async function userIsDealer(supabase, userId) {
    const role = await fetchRole(supabase, userId);
    return isDealerRole(role);
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
