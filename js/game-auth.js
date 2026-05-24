/** Sessão Supabase no jogo: proteção de rota, saldo na nuvem, logout. */
(function () {
  let readyResolve;
  const readyPromise = new Promise((r) => {
    readyResolve = r;
  });

  let userId = null;
  let userEmail = null;
  let userDisplayName = null;
  let persistTimer = null;

  async function init() {
    if (DealerAccess.mustLockSite() && !SupabaseApp.isConfigured()) {
      window.location.replace("login.html?error=config");
      return;
    }

    if (!SupabaseApp.isConfigured()) {
      hideUserBar();
      showGuestLoginLink();
      readyResolve();
      return;
    }

    const supabase = SupabaseApp.getClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      const next = encodeURIComponent(
        window.location.pathname.split("/").pop() || "index.html"
      );
      window.location.replace(`login.html?redirect=${next}`);
      return;
    }

    const isDealer = await DealerAccess.userIsDealer(supabase, data.session.user.id);
    if (!isDealer) {
      await DealerAccess.denyAndRedirectToLogin(supabase, "not_dealer");
      return;
    }

    userId = data.session.user.id;
    userEmail = data.session.user.email || "";
    userDisplayName =
      data.session.user.user_metadata?.display_name ||
      userEmail.split("@")[0] ||
      "Jogador";
    showUserBar(userEmail);

    await syncProfile();
    await loadGameState();
    readyResolve();

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.replace("login.html");
      }
    });
  }

  function showUserBar(email) {
    const bar = document.getElementById("user-bar");
    const emailEl = document.getElementById("user-email");
    const logout = document.getElementById("btn-logout");
    const link = document.getElementById("link-login");

    link?.classList.add("hidden");
    logout?.classList.remove("hidden");
    emailEl?.classList.remove("hidden");

    if (bar) {
      bar.classList.remove("hidden");
      bar.classList.add("user-bar--active");
    }
    if (emailEl) emailEl.textContent = email;
  }

  function hideUserBar() {
    const bar = document.getElementById("user-bar");
    const logout = document.getElementById("btn-logout");
    const link = document.getElementById("link-login");
    const emailEl = document.getElementById("user-email");

    logout?.classList.add("hidden");
    link?.classList.add("hidden");
    emailEl?.classList.add("hidden");

    if (bar) {
      bar.classList.add("hidden");
      bar.classList.remove("user-bar--active");
    }
  }

  function showGuestLoginLink() {
    const bar = document.getElementById("user-bar");
    const link = document.getElementById("link-login");
    const logout = document.getElementById("btn-logout");
    const emailEl = document.getElementById("user-email");

    logout?.classList.add("hidden");
    emailEl?.classList.add("hidden");
    link?.classList.remove("hidden");

    if (bar) {
      bar.classList.remove("hidden");
      bar.classList.remove("user-bar--active");
    }
  }

  async function syncProfile() {
    const supabase = SupabaseApp.getClient();
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: userEmail,
          display_name: userDisplayName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("display_name")
      .single();

    if (!error && data?.display_name) {
      userDisplayName = data.display_name;
    }
  }

  async function saveSpinRecord(payload) {
    if (!userId || !SupabaseApp.isConfigured()) return;

    const state = window.WarcraftSlots?.getState?.() || {};
    const supabase = SupabaseApp.getClient();

    const { data: spinRow, error: spinError } = await supabase
      .from("spins")
      .insert({
        user_id: userId,
        spin_number: state.spinCounter ?? payload.spinNumber,
        kind: payload.kind,
        bet_total: payload.betTotal,
        total_win: payload.totalWin,
        balance_before: payload.balanceBefore,
        balance_after: payload.balanceAfter,
        reel_window: payload.reelWindow,
        scatter_count: payload.scatterCount ?? 0,
        fs_awarded: payload.fsAwarded ?? 0,
        fs_remaining_after: payload.fsRemainingAfter ?? 0,
        paytable_scale: state.paytableScale ?? 1,
        rtp_profile: state.rtpProfile ?? null,
        player_email: userEmail,
        player_display_name: userDisplayName,
      })
      .select("id")
      .single();

    if (spinError) {
      console.warn("Erro ao salvar giro:", spinError.message);
      return;
    }

    const wins = payload.lineWins || [];
    if (wins.length > 0 && spinRow?.id) {
      const rows = wins.map((w) => ({
        spin_id: spinRow.id,
        line_index: w.lineIndex,
        target_symbol: w.target,
        match_count: w.matchCount,
        payout: w.payout,
      }));
      const { error: lineError } = await supabase.from("spin_line_wins").insert(rows);
      if (lineError) console.warn("Erro ao salvar linhas do giro:", lineError.message);
    }
  }

  async function loadGameState() {
    const supabase = SupabaseApp.getClient();
    const { data, error } = await supabase
      .from("player_game_state")
      .select(
        "balance, last_win, bet_total, fs_remaining, spin_counter, paid_spin_counter, paytable_scale, rtp_profile"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Erro ao carregar estado:", error.message);
      return;
    }
    if (data && window.WarcraftSlots?.applyState) {
      window.WarcraftSlots.applyState(data);
    }
  }

  function schedulePersist() {
    if (!userId || !SupabaseApp.isConfigured()) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistGameState, 400);
  }

  async function persistGameState() {
    if (!userId || !window.WarcraftSlots?.getState) return;
    const state = window.WarcraftSlots.getState();
    const supabase = SupabaseApp.getClient();
    const { error } = await supabase
      .from("player_game_state")
      .update({
        balance: state.balance,
        last_win: state.lastWin,
        bet_total: state.betTotal,
        fs_remaining: state.fsRemaining,
        spin_counter: state.spinCounter,
        paid_spin_counter: state.paidSpinCounter,
        paytable_scale: state.paytableScale,
        rtp_profile: state.rtpProfile,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) console.warn("Erro ao salvar estado:", error.message);
  }

  async function signOut() {
    const supabase = SupabaseApp.getClient();
    await supabase.auth.signOut();
    window.location.replace("login.html");
  }

  document.getElementById("btn-logout")?.addEventListener("click", signOut);

  window.GameAuth = {
    whenReady: () => readyPromise,
    schedulePersist,
    saveSpinRecord,
    getUserId: () => userId,
    getPlayerLabel: () => ({ email: userEmail, name: userDisplayName }),
  };

  init();
})();
