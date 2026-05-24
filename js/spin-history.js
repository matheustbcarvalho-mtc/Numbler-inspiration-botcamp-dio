/** Aba Histórico — lista apostas/giros do Supabase. */
(function () {
  const tabGame = document.getElementById("tab-game");
  const tabHistory = document.getElementById("tab-history");
  const viewGame = document.getElementById("view-game");
  const viewHistory = document.getElementById("view-history");
  const historyBody = document.getElementById("history-tbody");
  const historyStatus = document.getElementById("history-status");
  const historySummary = document.getElementById("history-summary");
  const btnHistoryRefresh = document.getElementById("btn-history-refresh");
  const filterKind = document.getElementById("history-filter-kind");

  const SELECT_FULL =
    "id, spin_number, kind, bet_total, total_win, balance_before, balance_after, scatter_count, fs_awarded, fs_remaining_after, created_at, user_id, player_email, player_display_name";
  const SELECT_MIN =
    "id, spin_number, kind, bet_total, total_win, balance_before, balance_after, scatter_count, fs_awarded, fs_remaining_after, created_at, user_id";

  let cachedSpins = [];
  let loadedOnce = false;

  function formatMoney(value) {
    return Number(value).toFixed(2);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function kindLabel(kind) {
    return kind === "free" ? "Free spin" : "Pago";
  }

  function setStatus(text, type) {
    if (!historyStatus) return;
    historyStatus.textContent = text || "";
    historyStatus.className = "history-status" + (type ? ` ${type}` : "");
  }

  function updateHistoryTabLabel() {
    if (!tabHistory) return;
    const n = cachedSpins.length;
    tabHistory.textContent = n > 0 ? `Histórico (${n})` : "Histórico";
  }

  function setActiveTab(mode) {
    const isHistory = mode === "history";
    tabGame?.classList.toggle("active", !isHistory);
    tabHistory?.classList.toggle("active", isHistory);
    viewGame?.classList.toggle("hidden", isHistory);
    viewHistory?.classList.toggle("hidden", !isHistory);
    if (isHistory) loadHistory();
  }

  function renderSummary(rows) {
    if (!historySummary) return;
    const paid = rows.filter((r) => r.kind === "paid");
    const totalBet = paid.reduce((s, r) => s + Number(r.bet_total || 0), 0);
    const totalWin = rows.reduce((s, r) => s + Number(r.total_win || 0), 0);
    const net = totalWin - totalBet;

    historySummary.innerHTML = `
      <div class="history-stat"><span>Giros</span><strong>${rows.length}</strong></div>
      <div class="history-stat"><span>Apostado (pagos)</span><strong>R$ ${formatMoney(totalBet)}</strong></div>
      <div class="history-stat"><span>Ganhos</span><strong>R$ ${formatMoney(totalWin)}</strong></div>
      <div class="history-stat"><span>Resultado</span><strong class="${net >= 0 ? "pos" : "neg"}">R$ ${formatMoney(net)}</strong></div>
    `;
  }

  function filteredRows() {
    const f = filterKind?.value || "all";
    if (f === "all") return cachedSpins;
    return cachedSpins.filter((r) => r.kind === f);
  }

  function renderTable() {
    if (!historyBody) return;
    const rows = filteredRows();

    if (rows.length === 0) {
      const f = filterKind?.value || "all";
      const hint =
        f !== "all"
          ? " Nenhum giro com esse filtro — escolha «Todos»."
          : " Faça um giro logado; a linha verde no topo deve mostrar «salvo na nuvem».";
      historyBody.innerHTML = `<tr><td colspan="9" class="history-empty">Nenhum giro encontrado.${hint}</td></tr>`;
      renderSummary([]);
      return;
    }

    historyBody.innerHTML = rows
      .map((row) => {
        const win = Number(row.total_win || 0);
        const winClass = win > 0 ? "history-win-pos" : "";
        const prof = row.profiles;
        const email = prof?.email || row.player_email || "";
        const player =
          prof?.display_name ||
          row.player_display_name ||
          (email ? email.split("@")[0] : null) ||
          "Jogador";
        return `<tr>
          <td>#${row.spin_number}</td>
          <td>${formatDate(row.created_at)}</td>
          <td class="history-player" title="${email}">${player}${email ? `<br><small>${email}</small>` : ""}</td>
          <td><span class="history-badge history-badge--${row.kind}">${kindLabel(row.kind)}</span></td>
          <td>R$ ${formatMoney(row.bet_total)}</td>
          <td class="${winClass}">R$ ${formatMoney(win)}</td>
          <td>R$ ${formatMoney(row.balance_after)}</td>
          <td>${row.scatter_count ?? 0}</td>
          <td>${row.fs_awarded > 0 ? `+${row.fs_awarded}` : "—"}</td>
        </tr>`;
      })
      .join("");

    renderSummary(rows);
  }

  async function fetchSpins(supabase, userId, isDealer) {
    const selects = [SELECT_FULL, SELECT_MIN];
    let lastError = null;

    for (const baseSelect of selects) {
      let query = supabase
        .from("spins")
        .select(baseSelect)
        .order("created_at", { ascending: false })
        .limit(250);

      if (!isDealer) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (!error) return { data: data || [], error: null };
      lastError = error;

      if (!/column|does not exist|player_email|player_display/i.test(error.message)) {
        break;
      }
    }

    if (isDealer && lastError) {
      const { data, error } = await supabase
        .from("spins")
        .select(SELECT_MIN)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(250);
      if (!error) return { data: data || [], error: null };
      lastError = error;
    }

    return { data: null, error: lastError };
  }

  async function loadHistory() {
    if (!SupabaseApp.isConfigured()) {
      setStatus("Supabase não configurado.", "error");
      return;
    }

    if (window.GameAuth?.whenReady) {
      await window.GameAuth.whenReady();
    }

    const userId = window.GameAuth?.getUserId?.();
    if (!userId) {
      setStatus("Faça login para ver o histórico.", "info");
      historyBody.innerHTML = `<tr><td colspan="9" class="history-empty">Não autenticado.</td></tr>`;
      updateHistoryTabLabel();
      return;
    }

    setStatus("Carregando…", "info");
    btnHistoryRefresh && (btnHistoryRefresh.disabled = true);

    const supabase = SupabaseApp.getClient();
    const isDealer = await DealerAccess.userIsDealer(supabase, userId);
    const { data, error } = await fetchSpins(supabase, userId, isDealer);

    btnHistoryRefresh && (btnHistoryRefresh.disabled = false);

    if (error) {
      let hint = "";
      if (/permission denied|row-level security|policy/i.test(error.message)) {
        hint =
          " Execute o Anexo B em supabase/ESTRUTURA_SUPABASE.md (políticas Giros: leitura/inserção).";
      }
      setStatus(`Erro ao carregar: ${error.message}.${hint}`, "error");
      return;
    }

    cachedSpins = data || [];
    loadedOnce = true;
    updateHistoryTabLabel();

    const label = window.GameAuth?.getPlayerLabel?.();
    const who = label?.email || label?.name || "você";
    const scope = isDealer ? "todos os jogadores" : "suas apostas";
    setStatus(`${cachedSpins.length} giro(s) · ${scope} · ${who}`, "ok");
    renderTable();
  }

  function refresh() {
    loadHistory();
  }

  function notifySaved(spinNumber) {
    updateHistoryTabLabel();
    if (!viewHistory?.classList.contains("hidden")) {
      setStatus(`Giro #${spinNumber} salvo na nuvem.`, "ok");
      loadHistory();
    } else {
      loadedOnce = true;
    }
  }

  function notifySaveError(message) {
    const hint = /save_spin_history|does not exist/i.test(message || "")
      ? " Rode o Anexo B no SQL Editor do Supabase."
      : "";
    setStatus(`Falha ao salvar giro: ${message}${hint}`, "error");
    if (!viewHistory?.classList.contains("hidden")) loadHistory();
  }

  tabGame?.addEventListener("click", () => setActiveTab("game"));
  tabHistory?.addEventListener("click", () => setActiveTab("history"));
  btnHistoryRefresh?.addEventListener("click", loadHistory);
  filterKind?.addEventListener("change", renderTable);

  document.addEventListener("gameauth-ready", () => {
    loadHistory().catch((err) => console.warn("Histórico inicial:", err));
  });

  window.SpinHistory = { refresh, loadHistory, setActiveTab, notifySaved, notifySaveError };
})();
