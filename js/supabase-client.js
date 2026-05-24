/** Cliente Supabase compartilhado (login + jogo). */
(function () {
  let client = null;

  function isConfigured() {
    const url = (window.SUPABASE_URL || "").trim();
    const key = (window.SUPABASE_ANON_KEY || "").trim();
    const keyOk =
      key.startsWith("eyJ") ||
      key.startsWith("sb_publishable_") ||
      key.startsWith("sb_");
    return Boolean(
      url &&
        key &&
        keyOk &&
        url.startsWith("https://") &&
        url.includes(".supabase.co") &&
        url !== "https://SEU_PROJETO.supabase.co" &&
        !key.includes("SUA_CHAVE") &&
        !key.includes("COLE_A_CHAVE")
    );
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!client && window.supabase?.createClient) {
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
    return client;
  }

  window.SupabaseApp = { isConfigured, getClient };
})();
