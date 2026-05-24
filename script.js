// --- Tiras r1–r5 (pesos calibrados ~92% RTP com paytable base + FS) ---

function buildStrip(counts) {
  const strip = [];
  for (const [symbol, count] of counts) {
    for (let i = 0; i < count; i++) strip.push(symbol);
  }
  return strip;
}

const SCATTER_SYMBOL = "Scatter";
const SCATTER_FS_AWARDS = { 3: 10, 4: 15, 5: 20 };
/** Compra dealer: 3 scatters na grade por este valor (concede FS de 3 scatters). */
const SCATTER_BUY_COST = 50;
const SCATTER_BUY_COUNT = 3;
const SCATTER_BUY_FILL = ["9", "10", "J", "Q", "K", "A"];
let dealerScatterBuyEnabled = false;

/** Free spins: +10% peso em símbolos premium nas tiras (sorte). */
const FS_LUCK_BOOST = 1.1;
const FS_LUCK_PREMIUM = new Set(["Wild", "P1", "P2", "A", "K", "Q"]);
const FS_LUCK_LOW = new Set(["9", "10", "J"]);
let fsLuckStripsCache = null;

const reelStrips = [
  buildStrip([
    ["Wild", 1],
    ["P1", 1],
    ["P2", 1],
    ["A", 3],
    ["K", 6],
    ["Q", 10],
    ["J", 14],
    ["10", 19],
    ["9", 21],
    [SCATTER_SYMBOL, 1],
  ]),
  buildStrip([
    ["Wild", 1],
    ["P1", 1],
    ["P2", 2],
    ["A", 4],
    ["K", 7],
    ["Q", 10],
    ["J", 14],
    ["10", 18],
    ["9", 19],
    [SCATTER_SYMBOL, 1],
  ]),
  buildStrip([
    ["Wild", 1],
    ["P1", 1],
    ["P2", 1],
    ["A", 3],
    ["K", 5],
    ["Q", 11],
    ["J", 15],
    ["10", 19],
    ["9", 20],
    [SCATTER_SYMBOL, 1],
  ]),
  buildStrip([
    ["Wild", 1],
    ["P1", 1],
    ["P2", 1],
    ["A", 2],
    ["K", 6],
    ["Q", 12],
    ["J", 16],
    ["10", 19],
    ["9", 19],
    [SCATTER_SYMBOL, 1],
  ]),
  buildStrip([
    ["A", 1],
    ["K", 4],
    ["Q", 12],
    ["J", 17],
    ["10", 20],
    ["9", 22],
    [SCATTER_SYMBOL, 1],
  ]),
];

const BASE_PAYTABLE = {
  P1: { 5: 11300, 4: 2260, 3: 565 },
  P2: { 5: 5650, 4: 1130, 3: 226 },
  A: { 5: 2260, 4: 565, 3: 113 },
  K: { 5: 1130, 4: 226, 3: 56 },
  Q: { 5: 565, 4: 113, 3: 23 },
  J: { 5: 226, 4: 56, 3: 11 },
  10: { 5: 113, 4: 23, 3: 6 },
  9: { 5: 56, 4: 11, 3: 2 },
};

let paytable = deepCopyPaytable(BASE_PAYTABLE);
let paytableScale = 1.0;
let currentRtpProfile = "92% (tiras)";

const paylines = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
];

const symbolMapping = {
  P1: "assets/symbol_p1_dragon.png",
  P2: "assets/symbol_p2_minotaur.png",
  Wild: "assets/symbol_wild_chest.png",
  A: "assets/symbol_a_paladin.png",
  K: "assets/symbol_k_king.png",
  Q: "assets/symbol_q_mage.png",
  J: "assets/symbol_j_jester.png",
  10: "assets/symbol_10_kobold.png",
  9: "assets/symbol_9_goblin.png",
  Scatter: "assets/symbol_scatter_crystal.png",
};

const BET_OPTIONS = [5, 10, 20, 50];
/** Aposta efetiva em todo free spin (prêmios de linha). */
const FREE_SPIN_BET_FIXED = 50;
let betTotal = 5;
const SPIN_BASE_MS = 650;
const CASCADE_DELAY_MS = 90;
const EXTRA_BLUR_SYMBOLS = 10;
const PAUSE_BETWEEN_MS = 450;
const PAUSE_AFTER_WIN_MS = 1100;
const PAUSE_AFTER_FS_TRIGGER_MS = 1200;
const WIN_BLINK_DURATION_MS = 1050;

let balance = 1000.0;
let lastWin = 0.0;
let isSpinning = false;
let autoRunning = false;
let autoPaidRemaining = 0;
let fsRemaining = 0;
let auditEnabled = false;
let spinCounter = 0;
let paidSpinCounter = 0;

let rtpSimState = { running: false, cancel: false };
let calibState = { running: false };

// --- Utilitários ---

function deepCopyPaytable(table) {
  const out = {};
  for (const sym of Object.keys(table)) {
    out[sym] = { ...table[sym] };
  }
  return out;
}

function scalePaytable(baseTable, scale) {
  const out = {};
  for (const [sym, tiers] of Object.entries(baseTable)) {
    out[sym] = {};
    for (const [k, v] of Object.entries(tiers)) {
      out[sym][k] = Math.max(1, Math.round(v * scale));
    }
  }
  return out;
}

/** Paytable base (×1.0) — tiras já calibradas ~92% RTP. */
function resetPaytableToBase() {
  paytable = deepCopyPaytable(BASE_PAYTABLE);
  paytableScale = 1.0;
  currentRtpProfile = "92% (tiras ×1.0)";
  updateMeters();
}

function updateRtpProfileLabel() {
  const scaleTxt =
    Math.abs(paytableScale - 1) < 0.02
      ? "×1.0"
      : `paytable ×${paytableScale.toFixed(2)}`;
  document.getElementById("rtp-profile").textContent = `${currentRtpProfile} · ${scaleTxt}`;
}

function formatMoney(value) {
  return value.toFixed(2);
}

function formatPct(ratio) {
  return `${(ratio * 100).toFixed(3)}%`;
}

function houseEdgeFromRtp(rtp) {
  return Math.max(0, 1 - rtp);
}

/** IC 95% do RTP limitado ao intervalo válido [0%, 100%]. */
function clampRtpCi95(low, high) {
  const lo = Math.max(0, Math.min(1, low));
  const hi = Math.max(0, Math.min(1, high));
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function yieldToMain() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countScatters(window) {
  return window.reduce((n, col) => n + col.filter((s) => s === SCATTER_SYMBOL).length, 0);
}

function pickScatterBuyFillSymbol() {
  return SCATTER_BUY_FILL[Math.floor(Math.random() * SCATTER_BUY_FILL.length)];
}

/** Grade 5×3 com exatamente `count` scatters (um por rolo, em rolos distintos). */
function buildWindowWithScatterCount(count) {
  const window = spinReels();
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      if (window[c][r] === SCATTER_SYMBOL) {
        window[c][r] = pickScatterBuyFillSymbol();
      }
    }
  }
  const cols = [0, 1, 2, 3, 4];
  for (let i = cols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }
  for (const c of cols.slice(0, count)) {
    const row = Math.floor(Math.random() * 3);
    for (let r = 0; r < 3; r++) {
      window[c][r] =
        r === row ? SCATTER_SYMBOL : pickScatterBuyFillSymbol();
    }
  }
  return window;
}

function freeSpinsAwarded(scatterCount) {
  let fs = 0;
  for (const need of Object.keys(SCATTER_FS_AWARDS).map(Number).sort((a, b) => a - b)) {
    if (scatterCount >= need) fs = SCATTER_FS_AWARDS[need];
  }
  return fs;
}

// --- Motor ---

function buildStripsWithLuckBoost(strips, boost) {
  return strips.map((strip) => {
    const counts = {};
    for (const sym of strip) counts[sym] = (counts[sym] || 0) + 1;
    for (const sym of Object.keys(counts)) {
      if (sym === SCATTER_SYMBOL) continue;
      if (FS_LUCK_PREMIUM.has(sym)) {
        counts[sym] = Math.max(1, Math.round(counts[sym] * boost));
      } else if (FS_LUCK_LOW.has(sym)) {
        counts[sym] = Math.max(1, Math.round(counts[sym] / boost));
      }
    }
    return buildStrip(Object.entries(counts).map(([symbol, count]) => [symbol, count]));
  });
}

function getReelStripsForSpin(isFreeSpin) {
  if (!isFreeSpin) return reelStrips;
  if (!fsLuckStripsCache) {
    fsLuckStripsCache = buildStripsWithLuckBoost(reelStrips, FS_LUCK_BOOST);
  }
  return fsLuckStripsCache;
}

function spinReels(rng = Math.random, isFreeSpin = false) {
  const window = [];
  const rand = typeof rng === "function" ? rng : () => rng();
  const strips = getReelStripsForSpin(isFreeSpin);
  for (let i = 0; i < 5; i++) {
    const strip = strips[i];
    const stop = Math.floor(rand() * strip.length);
    window.push([
      strip[stop % strip.length],
      strip[(stop + 1) % strip.length],
      strip[(stop + 2) % strip.length],
    ]);
  }
  return window;
}

function evaluateWins(window, table = paytable, wagerBet = betTotal) {
  let totalWin = 0;
  const betPerLine = wagerBet / 5;
  const highlights = [];
  const lineWins = [];

  paylines.forEach((line, lineIdx) => {
    const lineSymbols = line.map((row, col) => window[col][row]);

    let target = null;
    for (const s of lineSymbols) {
      if (s !== "Wild" && s !== SCATTER_SYMBOL) {
        target = s;
        break;
      }
    }
    if (!target) return;

    let matchCount = 0;
    for (const s of lineSymbols) {
      if (s === SCATTER_SYMBOL) break;
      if (s === target || s === "Wild") matchCount++;
      else break;
    }

    if (table[target] && table[target][matchCount]) {
      const payout = table[target][matchCount] * betPerLine;
      totalWin += payout;
      lineWins.push({
        lineIndex: lineIdx + 1,
        target,
        matchCount,
        payout,
      });
      for (let c = 0; c < matchCount; c++) {
        highlights.push([c, line[c]]);
      }
    }
  });

  const scatterCount = countScatters(window);
  const fsAward = freeSpinsAwarded(scatterCount);

  return { totalWin, highlights, scatterCount, fsAward, lineWins };
}

/**
 * Um giro pago + cadeia de free spins (retriggers inclusos).
 * RTP = retorno deste pacote / betTotal — FS não inflam o denominador.
 */
function resolvePaidSpinWithFreeSpins(rng, table) {
  const rand = typeof rng === "function" ? rng : () => rng();
  let total = 0;

  const first = evaluateWins(spinReels(rand), table);
  total += first.totalWin;
  let fsRem = first.fsAward;

  while (fsRem > 0) {
    const next = evaluateWins(spinReels(rand, true), table, FREE_SPIN_BET_FIXED);
    total += next.totalWin;
    fsRem -= 1;
    if (next.fsAward > 0) fsRem += next.fsAward;
  }

  return total;
}

// --- DOM dos rolos ---

function createSymbolCell(symbol) {
  const cell = document.createElement("div");
  cell.className = "reel-cell";
  cell.dataset.symbol = symbol;

  const img = document.createElement("img");
  img.alt = symbol;
  img.src = symbolMapping[symbol] || "";
  img.onerror = () => {
    cell.classList.add("fallback");
    cell.textContent = symbol;
    img.remove();
  };
  cell.appendChild(img);
  return cell;
}

function buildAnimStrip(finalColumn, strip) {
  const symbols = [];
  for (let i = 0; i < EXTRA_BLUR_SYMBOLS; i++) {
    symbols.push(strip[Math.floor(Math.random() * strip.length)]);
  }
  return symbols.concat(finalColumn);
}

function initReels() {
  const container = document.getElementById("reels-columns");
  container.innerHTML = "";

  for (let col = 0; col < 5; col++) {
    const columnEl = document.createElement("div");
    columnEl.className = "reel-column";
    columnEl.dataset.col = String(col);

    const stripEl = document.createElement("div");
    stripEl.className = "reel-strip";
    columnEl.appendChild(stripEl);
    container.appendChild(columnEl);
  }
}

function setColumnStrip(col, symbols) {
  const stripEl = document.querySelector(`.reel-column[data-col="${col}"] .reel-strip`);
  stripEl.innerHTML = "";
  symbols.forEach((sym) => stripEl.appendChild(createSymbolCell(sym)));
  stripEl.style.transition = "none";
  stripEl.style.transform = "translateY(0)";
  stripEl.classList.remove("spinning");
  return stripEl;
}

function getCellHeight() {
  const probe = document.querySelector(".reel-cell");
  if (probe) return probe.offsetHeight;
  const root = getComputedStyle(document.documentElement);
  return parseFloat(root.getPropertyValue("--cell-size")) || 108;
}

function animateColumnStop(col, finalColumn) {
  return new Promise((resolve) => {
    const columnEl = document.querySelector(`.reel-column[data-col="${col}"]`);
    const strip = reelStrips[col];
    const animSymbols = buildAnimStrip(finalColumn, strip);
    const stripEl = setColumnStrip(col, animSymbols);
    const cellH = getCellHeight();
    const offset = (animSymbols.length - 3) * cellH;

    columnEl.classList.add("spinning");
    stripEl.classList.add("spinning");

    requestAnimationFrame(() => {
      stripEl.style.transition = `transform ${SPIN_BASE_MS}ms cubic-bezier(0.12, 0.8, 0.22, 1)`;
      stripEl.style.transform = `translateY(-${offset}px)`;
    });

    const onEnd = () => {
      stripEl.removeEventListener("transitionend", onEnd);
      setColumnStrip(col, finalColumn);
      columnEl.classList.remove("spinning");
      resolve();
    };
    stripEl.addEventListener("transitionend", onEnd);
  });
}

async function animateCascadeSpin(window) {
  const tasks = [];
  for (let col = 0; col < 5; col++) {
    tasks.push(
      (async () => {
        await new Promise((r) => setTimeout(r, col * CASCADE_DELAY_MS));
        await animateColumnStop(col, window[col]);
      })()
    );
  }
  await Promise.all(tasks);
}

const SVG_NS = "http://www.w3.org/2000/svg";
const WIN_LINE_PALETTE = ["#7fff9a", "#ffd700", "#6ecfff", "#ff9f7f", "#d4a0ff"];

function getCellCenter(col, row, wrapperEl) {
  const cell = document.querySelector(
    `.reel-column[data-col="${col}"] .reel-cell:nth-child(${row + 1})`
  );
  if (!cell || !wrapperEl) return null;
  const wrapRect = wrapperEl.getBoundingClientRect();
  const rect = cell.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - wrapRect.left,
    y: rect.top + rect.height / 2 - wrapRect.top,
  };
}

function clearWinLines() {
  const overlay = document.getElementById("win-lines-overlay");
  if (overlay) overlay.replaceChildren();
}

function buildWinLinePathD(points) {
  return points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function animateWinLineDraw(pathEl) {
  const len = pathEl.getTotalLength?.() ?? 0;
  if (len <= 0) return;
  pathEl.style.strokeDasharray = `${len}`;
  pathEl.style.strokeDashoffset = `${len}`;
  requestAnimationFrame(() => {
    pathEl.style.transition = "stroke-dashoffset 0.45s ease-out";
    pathEl.style.strokeDashoffset = "0";
  });
}

function drawWinLines(lineWins) {
  const overlay = document.getElementById("win-lines-overlay");
  const stage = document.getElementById("reels-stage");
  if (!overlay || !stage || !lineWins?.length) return;

  clearWinLines();

  const w = stage.clientWidth;
  const h = stage.clientHeight;
  overlay.setAttribute("viewBox", `0 0 ${w} ${h}`);

  lineWins.forEach((win, i) => {
    const payline = paylines[win.lineIndex - 1];
    if (!payline) return;

    const points = [];
    for (let col = 0; col < win.matchCount; col++) {
      const pt = getCellCenter(col, payline[col], stage);
      if (pt) points.push(pt);
    }
    if (points.length < 2) return;

    const color = WIN_LINE_PALETTE[i % WIN_LINE_PALETTE.length];
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "win-line-group");
    const d = buildWinLinePathD(points);

    const pathBg = document.createElementNS(SVG_NS, "path");
    pathBg.setAttribute("d", d);
    pathBg.setAttribute("class", "win-line-path-bg");
    pathBg.setAttribute("fill", "none");
    group.appendChild(pathBg);

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "win-line-path");
    path.setAttribute("stroke", color);
    path.setAttribute("fill", "none");
    group.appendChild(path);

    animateWinLineDraw(pathBg);
    animateWinLineDraw(path);

    points.forEach((p) => {
      const node = document.createElementNS(SVG_NS, "circle");
      node.setAttribute("cx", String(p.x));
      node.setAttribute("cy", String(p.y));
      node.setAttribute("r", "7");
      node.setAttribute("class", "win-line-node");
      node.setAttribute("stroke", color);
      group.appendChild(node);
    });

    overlay.appendChild(group);
  });
}

function renderWindow(window, highlights = [], lineWins = []) {
  for (let col = 0; col < 5; col++) {
    setColumnStrip(col, window[col]);
  }
  highlights.forEach(([col, row]) => {
    const cells = document.querySelectorAll(
      `.reel-column[data-col="${col}"] .reel-cell`
    );
    if (cells[row]) cells[row].classList.add("win-highlight");
  });
  clearWinLines();
  if (lineWins.length > 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => drawWinLines(lineWins));
    });
  }
}

// --- UI ---

function updateMeters() {
  document.getElementById("balance").textContent = formatMoney(balance);
  document.getElementById("win").textContent = formatMoney(lastWin);
  const headerBet = document.getElementById("header-bet");
  if (headerBet) headerBet.textContent = `R$ ${formatMoney(betTotal)}`;
  updateRtpProfileLabel();
  updateFsBadge();
  updateBetButtons();
}

function updateFsBadge() {
  const badge = document.getElementById("fs-badge");
  const el = document.getElementById("fs-remaining");
  if (fsRemaining > 0) {
    badge.classList.remove("hidden");
    el.textContent = String(fsRemaining);
  } else {
    badge.classList.add("hidden");
    el.textContent = "0";
  }
}

function updateAutoButton() {
  const btn = document.getElementById("btn-auto");
  if (autoRunning) {
    btn.textContent =
      autoPaidRemaining > 0 ? `PARAR (${autoPaidRemaining})` : "PARAR AUTO";
  } else {
    btn.textContent = "AUTO";
  }
  btn.classList.toggle("active", autoRunning);
}

function canChangeBet() {
  return (
    !isSpinning &&
    !autoRunning &&
    fsRemaining <= 0 &&
    !rtpSimState.running &&
    !calibState.running
  );
}

function setBetAmount(amount) {
  if (!BET_OPTIONS.includes(amount)) return;
  if (!canChangeBet()) return;
  betTotal = amount;
  updateBetButtons();
  updateMeters();
  window.GameAuth?.schedulePersist?.();
  auditLog(`APOSTA alterada para R$ ${formatMoney(betTotal)}`);
}

function updateBetButtons() {
  document.querySelectorAll(".btn-bet").forEach((btn) => {
    const value = Number(btn.dataset.bet);
    btn.classList.toggle("active", value === betTotal);
    btn.disabled = !canChangeBet();
  });
}

function refreshControlsState() {
  const simBusy = rtpSimState.running || calibState.running;
  const playBusy = isSpinning || autoRunning || simBusy;

  document.getElementById("btn-rtp-test").disabled = simBusy;
  document.getElementById("btn-rtp-92").disabled = simBusy;
  document.getElementById("btn-rtp-95").disabled = simBusy;
  document.getElementById("btn-auto").disabled = simBusy;
  document.getElementById("spin-button").disabled =
    playBusy || (balance < betTotal && fsRemaining <= 0);
  const buyScatters = document.getElementById("btn-buy-scatters");
  if (buyScatters && dealerScatterBuyEnabled) {
    buyScatters.disabled = playBusy || balance < SCATTER_BUY_COST;
  }
  updateBetButtons();
}

function setSpinningUI(spinning) {
  isSpinning = spinning;
  refreshControlsState();
}

/** Bloqueia só botões de ferramentas (não altera isSpinning). */
function setToolsBlocked(blocked) {
  document.getElementById("btn-rtp-test").disabled = blocked;
  document.getElementById("btn-rtp-92").disabled = blocked;
  document.getElementById("btn-rtp-95").disabled = blocked;
  refreshControlsState();
}

function getPostSpinDelay(result) {
  if (result.fsTriggered) return PAUSE_AFTER_FS_TRIGGER_MS;
  if (result.totalWin > 0) return PAUSE_AFTER_WIN_MS;
  return PAUSE_BETWEEN_MS;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setCloudSyncStatus(message, type = "") {
  const el = document.getElementById("cloud-sync-status");
  if (!el) return;
  el.textContent = message || "";
  el.className = "cloud-sync-status" + (type ? ` ${type}` : "");
}

function auditLog(message, lineWins = null) {
  if (!auditEnabled) return;
  const log = document.getElementById("audit-log");
  const row = document.createElement("div");
  row.className = "audit-line";
  const ts = new Date().toISOString().slice(11, 23);
  let html = `<span class="audit-ts">[${ts}]</span> <span class="audit-body">${escapeHtml(message)}</span>`;
  if (lineWins && lineWins.length > 0) {
    html +=
      " · " +
      lineWins
        .map(
          (w) =>
            `<span class="audit-win">Linha ${w.lineIndex}: ${escapeHtml(w.target)} ×${w.matchCount} +${formatMoney(w.payout)}</span>`
        )
        .join(" ");
  }
  row.innerHTML = html;
  log.prepend(row);
  while (log.children.length > 80) {
    log.lastChild.remove();
  }
}

function clearWinHighlights() {
  document.querySelectorAll(".win-highlight").forEach((el) => {
    el.classList.remove("win-highlight");
  });
}

function clearWinVisuals() {
  clearWinHighlights();
  clearWinLines();
}

function windowToString(window) {
  return window.map((col) => col.join("|")).join(" · ");
}

async function executeSpinOnce() {
  const isFreeSpin = fsRemaining > 0;

  if (!isFreeSpin && balance < betTotal) {
    return { ok: false, reason: "no_balance" };
  }

  setSpinningUI(true);

  const balanceBeforeSpin = balance;

  try {
    let wasPaid = false;
    if (isFreeSpin) {
      fsRemaining -= 1;
    } else {
      if (autoRunning && autoPaidRemaining <= 0) {
        return { ok: false, reason: "auto_done" };
      }
      balance -= betTotal;
      wasPaid = true;
      paidSpinCounter += 1;
      if (autoRunning) {
        autoPaidRemaining -= 1;
        updateAutoButton();
      }
    }
    spinCounter += 1;
    updateMeters();
    clearWinVisuals();

    const window = spinReels(Math.random, isFreeSpin);
    await animateCascadeSpin(window);

    const fsWager = FREE_SPIN_BET_FIXED;
    const { totalWin, highlights, scatterCount, fsAward, lineWins } = evaluateWins(
      window,
      paytable,
      isFreeSpin ? fsWager : betTotal
    );
    lastWin = totalWin;
    balance += lastWin;

    if (fsAward > 0) {
      fsRemaining += fsAward;
    }
    const fsTriggered = fsAward > 0;

    renderWindow(window, highlights, lineWins);
    updateMeters();

    const tag = isFreeSpin ? "FS +10% sorte" : "PAGO";
    auditLog(
      `#${spinCounter} ${tag} APOSTA=${isFreeSpin ? formatMoney(fsWager) : formatMoney(betTotal)} ` +
        `GANHO=${formatMoney(lastWin)} SCATTER=${scatterCount} FS+${fsAward} ` +
        `FS_REST=${fsRemaining} SALDO=${formatMoney(balance)}`,
      lineWins
    );

    if (lastWin > 0) {
      setTimeout(clearWinVisuals, WIN_BLINK_DURATION_MS);
    }

    const spinKind = isFreeSpin ? "free" : "paid";
    const spinPayload = {
      kind: spinKind,
      betTotal: wasPaid ? betTotal : FREE_SPIN_BET_FIXED,
      totalWin: lastWin,
      balanceBefore: balanceBeforeSpin,
      balanceAfter: balance,
      reelWindow: window,
      scatterCount,
      fsAwarded: fsAward,
      fsRemainingAfter: fsRemaining,
      spinNumber: spinCounter,
      lineWins,
    };

    let cloudSave = null;
    if (window.GameAuth?.saveSpinRecord) {
      try {
        cloudSave = await window.GameAuth.saveSpinRecord(spinPayload);
      } catch (err) {
        cloudSave = { ok: false, error: err?.message || String(err) };
      }
    }

    if (cloudSave?.ok) {
      window.CloudConnectivity?.markSessionActive?.();
      setCloudSyncStatus(`Histórico: giro #${cloudSave.spinNumber} salvo na nuvem.`, "ok");
      auditLog(`Nuvem OK · giro #${cloudSave.spinNumber} salvo no histórico`);
      window.SpinHistory?.notifySaved?.(cloudSave.spinNumber);
    } else if (cloudSave?.error) {
      setCloudSyncStatus(`Histórico: falha ao salvar — ${cloudSave.error}`, "error");
      auditLog(`ERRO ao salvar na nuvem: ${cloudSave.error}`);
      console.error("Histórico:", cloudSave.error);
      window.SpinHistory?.notifySaveError?.(cloudSave.error);
    } else {
      setCloudSyncStatus("Histórico: login necessário ou página desatualizada (Ctrl+F5).", "error");
      auditLog("ERRO: salvamento na nuvem não disponível (atualize a página)");
      window.SpinHistory?.notifySaveError?.("Função de salvamento indisponível (atualize a página)");
    }

    if (window.GameAuth?.persistGameState) {
      await window.GameAuth.persistGameState();
    }
    window.GameAuth?.schedulePersist?.();
    window.SpinHistory?.refresh?.();

    return {
      ok: true,
      totalWin,
      fsTriggered,
      fsAwarded: fsAward,
      wasPaid,
      isFreeSpin,
      lineWins,
      reelWindow: window,
    };
  } finally {
    setSpinningUI(false);
  }
}

async function handleSpin() {
  if (isSpinning || autoRunning || rtpSimState.running || calibState.running) return;
  if (fsRemaining <= 0 && balance < betTotal) {
    alert("Saldo insuficiente para apostar.");
    return;
  }
  await executeSpinOnce();
}

function applyDealerScatterBuyUI(isDealer) {
  const btn = document.getElementById("btn-buy-scatters");
  if (!btn) return;

  dealerScatterBuyEnabled = Boolean(isDealer);
  btn.classList.toggle("hidden", !dealerScatterBuyEnabled);
  btn.setAttribute("aria-hidden", dealerScatterBuyEnabled ? "false" : "true");
  refreshControlsState();
}

async function initDealerScatterBuyUI() {
  const btn = document.getElementById("btn-buy-scatters");
  if (!btn) return;

  applyDealerScatterBuyUI(false);

  if (!window.SupabaseApp?.isConfigured?.()) return;

  if (window.GameAuth?.isDealer?.()) {
    applyDealerScatterBuyUI(true);
    return;
  }

  const userId = window.GameAuth?.getUserId?.();
  if (!userId || !window.DealerAccess?.userIsDealer) return;

  try {
    const supabase = SupabaseApp.getClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isDealer = await DealerAccess.userIsDealer(supabase, userId, user);
    applyDealerScatterBuyUI(isDealer);
    if (!isDealer) {
      console.info(
        "Botão 3 Scatters oculto: perfil não é dealer. " +
          "Use código rumble2026 no cadastro ou peça UPDATE role=dealer no Supabase."
      );
    }
  } catch (err) {
    console.warn("Compra de scatters (dealer):", err);
  }
}

async function handleBuyScatters() {
  if (!dealerScatterBuyEnabled) return;
  const userId = window.GameAuth?.getUserId?.();
  if (userId && window.DealerAccess?.userIsDealer) {
    const isDealer = await DealerAccess.userIsDealer(SupabaseApp.getClient(), userId);
    if (!isDealer) {
      dealerScatterBuyEnabled = false;
      document.getElementById("btn-buy-scatters")?.classList.add("hidden");
      alert("Apenas contas dealer podem comprar scatters.");
      return;
    }
  }
  if (isSpinning || autoRunning || rtpSimState.running || calibState.running) return;

  if (balance < SCATTER_BUY_COST) {
    alert(`Saldo insuficiente. São necessários R$ ${formatMoney(SCATTER_BUY_COST)}.`);
    return;
  }

  if (
    !confirm(
      `Comprar ${SCATTER_BUY_COUNT} scatters por R$ ${formatMoney(SCATTER_BUY_COST)}?\n` +
        `Você receberá ${freeSpinsAwarded(SCATTER_BUY_COUNT)} free spins.`
    )
  ) {
    return;
  }

  setSpinningUI(true);
  const balanceBeforeSpin = balance;

  try {
    balance -= SCATTER_BUY_COST;
    spinCounter += 1;
    paidSpinCounter += 1;
    updateMeters();
    clearWinVisuals();

    const window = buildWindowWithScatterCount(SCATTER_BUY_COUNT);
    await animateCascadeSpin(window);

    const { totalWin, highlights, scatterCount, fsAward, lineWins } = evaluateWins(window);
    lastWin = totalWin;
    balance += totalWin;

    if (fsAward > 0) {
      fsRemaining += fsAward;
    }

    renderWindow(window, highlights, lineWins);
    updateMeters();

    auditLog(
      `#${spinCounter} COMPRA ${SCATTER_BUY_COUNT} SCATTERS −${formatMoney(SCATTER_BUY_COST)} ` +
        `GANHO=${formatMoney(lastWin)} SCATTER=${scatterCount} FS+${fsAward} ` +
        `FS_REST=${fsRemaining} SALDO=${formatMoney(balance)}`,
      lineWins
    );

    if (lastWin > 0) {
      setTimeout(clearWinVisuals, WIN_BLINK_DURATION_MS);
    }

    let cloudSave = null;
    if (window.GameAuth?.saveSpinRecord) {
      try {
        cloudSave = await window.GameAuth.saveSpinRecord({
          kind: "paid",
          betTotal: SCATTER_BUY_COST,
          totalWin: lastWin,
          balanceBefore: balanceBeforeSpin,
          balanceAfter: balance,
          reelWindow: window,
          scatterCount,
          fsAwarded: fsAward,
          fsRemainingAfter: fsRemaining,
          spinNumber: spinCounter,
          lineWins,
        });
      } catch (err) {
        cloudSave = { ok: false, error: err?.message || String(err) };
      }
    }
    if (cloudSave?.ok) {
      window.CloudConnectivity?.markSessionActive?.();
      setCloudSyncStatus(`Histórico: compra #${cloudSave.spinNumber} salva na nuvem.`, "ok");
      auditLog(`Nuvem OK · compra scatters #${cloudSave.spinNumber} salva no histórico`);
      window.SpinHistory?.notifySaved?.(cloudSave.spinNumber);
    } else if (cloudSave?.error) {
      setCloudSyncStatus(`Histórico: falha — ${cloudSave.error}`, "error");
      auditLog(`ERRO ao salvar compra na nuvem: ${cloudSave.error}`);
      window.SpinHistory?.notifySaveError?.(cloudSave.error);
    }
    if (window.GameAuth?.persistGameState) {
      await window.GameAuth.persistGameState();
    }
    window.GameAuth?.schedulePersist?.();
    window.SpinHistory?.refresh?.();
  } finally {
    setSpinningUI(false);
  }
}

function stopAuto() {
  autoRunning = false;
  autoPaidRemaining = 0;
  updateAutoButton();
  setSpinningUI(false);
}

function openAutoOverlay() {
  document.getElementById("overlay-auto").classList.remove("hidden");
}

function closeAutoOverlay() {
  document.getElementById("overlay-auto").classList.add("hidden");
}

function startAutoWithCount(count) {
  if (isSpinning || rtpSimState.running || calibState.running) return;
  if (balance < betTotal) {
    alert("Saldo insuficiente para modo automático.");
    return;
  }

  closeAutoOverlay();
  autoPaidRemaining = count;
  autoRunning = true;
  updateAutoButton();
  auditLog(`AUTO iniciado: ${count} giros pagos`);
  runAutoLoop();
}

async function runAutoLoop() {
  while (autoRunning) {
    if (rtpSimState.running || calibState.running) {
      stopAuto();
      break;
    }

    if (fsRemaining > 0) {
      // Free spins não consomem contador de giros pagos
    } else if (autoPaidRemaining > 0) {
      if (balance < betTotal) {
        stopAuto();
        auditLog("AUTO parado: saldo insuficiente");
        break;
      }
    } else {
      stopAuto();
      auditLog("AUTO concluído: giros pagos esgotados");
      break;
    }

    const result = await executeSpinOnce();
    if (!result.ok) {
      stopAuto();
      break;
    }

    if (!autoRunning) break;

    if (fsRemaining <= 0 && autoPaidRemaining <= 0) {
      stopAuto();
      auditLog("AUTO concluído");
      break;
    }

    await sleep(getPostSpinDelay(result));
  }
}

function toggleAuto() {
  if (autoRunning) {
    stopAuto();
    auditLog("AUTO cancelado pelo jogador");
    return;
  }
  if (isSpinning || rtpSimState.running || calibState.running) return;
  openAutoOverlay();
}

// --- Teste RTP ---

async function simulateRtp(spins, seed, onProgress) {
  const rng = createRng(seed);
  let totalWin = 0;
  let hits = 0;
  let maxWin = 0;
  let n = 0;
  let meanR = 0;
  let m2 = 0;
  const batch = Math.max(500, Math.floor(spins / 150));

  for (let i = 0; i < spins; i++) {
    if (rtpSimState.cancel) break;

    const gain = resolvePaidSpinWithFreeSpins(rng, paytable);
    totalWin += gain;
    if (gain > 0) {
      hits++;
      if (gain > maxWin) maxWin = gain;
    }

    n++;
    const ri = gain / betTotal;
    const delta = ri - meanR;
    meanR += delta / n;
    m2 += delta * (ri - meanR);

    if ((i + 1) % batch === 0 || i + 1 === spins) {
      const done = i + 1;
      const rtp = totalWin / (done * betTotal);
      onProgress({
        progress: done / spins,
        spinsDone: done,
        rtp,
        hitRate: hits / done,
        houseEdge: houseEdgeFromRtp(rtp),
      });
      await yieldToMain();
    }
  }

  const actualSpins = n;
  const totalBet = actualSpins * betTotal;
  const rtp = totalBet > 0 ? totalWin / totalBet : 0;
  const stdev = n > 1 ? Math.sqrt(m2 / (n - 1)) : 0;
  const stderr = n > 0 ? stdev / Math.sqrt(n) : 0;

  return {
    spins: actualSpins,
    canceled: rtpSimState.cancel,
    rtp,
    rtpCi95: clampRtpCi95(rtp - 1.96 * stderr, rtp + 1.96 * stderr),
    hitRate: actualSpins > 0 ? hits / actualSpins : 0,
    houseEdge: houseEdgeFromRtp(rtp),
    maxWin,
    totalWin,
    totalBet,
  };
}

function openRtpOverlay() {
  document.getElementById("overlay-rtp").classList.remove("hidden");
  document.getElementById("btn-rtp-close").disabled = true;
  document.getElementById("rtp-value").textContent = "—";
  document.getElementById("house-edge-value").textContent = "—";
  document.getElementById("hit-rate-value").textContent = "—";
  document.getElementById("ci95-value").textContent = "—";
  document.getElementById("rtp-progress-bar").style.width = "0%";
  const scaleWarn =
    paytableScale > 1.05
      ? ` ⚠ Paytable ×${paytableScale.toFixed(2)} infla o RTP — use RTP 92% ou recarregue.`
      : "";
  document.getElementById("rtp-progress-text").textContent =
    `Paytable ×${paytableScale.toFixed(2)} · tiras calibradas · 100k giros…${scaleWarn}`;
}

function updateRtpOverlay(partial) {
  if (partial.rtp != null) {
    document.getElementById("rtp-value").textContent = formatPct(partial.rtp);
    document.getElementById("house-edge-value").textContent = formatPct(
      partial.houseEdge ?? houseEdgeFromRtp(partial.rtp)
    );
  }
  if (partial.hitRate != null) {
    document.getElementById("hit-rate-value").textContent = formatPct(partial.hitRate);
  }
  if (partial.progress != null) {
    document.getElementById("rtp-progress-bar").style.width = `${partial.progress * 100}%`;
    document.getElementById("rtp-progress-text").textContent =
      `Giros: ${partial.spinsDone ?? "…"} · RTP parcial ${formatPct(partial.rtp ?? 0)}`;
  }
}

async function startRtpTest() {
  if (rtpSimState.running || isSpinning) return;

  rtpSimState = { running: true, cancel: false };
  openRtpOverlay();
  stopAuto();
  setToolsBlocked(true);

  const spins = 100000;
  const seed = 12345;

  try {
    const summary = await simulateRtp(spins, seed, updateRtpOverlay);
    document.getElementById("ci95-value").textContent = `${formatPct(summary.rtpCi95[0])} … ${formatPct(summary.rtpCi95[1])}`;
    document.getElementById("rtp-progress-text").textContent = summary.canceled
      ? "Simulação cancelada."
      : `Concluído: ${summary.spins} giros · Ganho total ${formatMoney(summary.totalWin)}`;
    document.getElementById("rtp-progress-bar").style.width = "100%";
    auditLog(
      `RTP_TEST spins=${summary.spins} rtp=${formatPct(summary.rtp)} ` +
        `house_edge=${formatPct(summary.houseEdge)} hit=${formatPct(summary.hitRate)}`
    );
  } catch (err) {
    console.error(err);
    document.getElementById("rtp-progress-text").textContent = `Erro: ${err.message}`;
  } finally {
    rtpSimState.running = false;
    isSpinning = false;
    setToolsBlocked(false);
    refreshControlsState();
    document.getElementById("btn-rtp-close").disabled = false;
  }
}

// --- Calibração RTP ---

async function estimateRtpForTable(table, spins, seed) {
  const rng = createRng(seed);
  let totalWin = 0;
  const block = Math.max(2000, Math.floor(spins / 80));

  for (let i = 0; i < spins; i++) {
    totalWin += resolvePaidSpinWithFreeSpins(rng, table);
    if ((i + 1) % block === 0) await yieldToMain();
  }
  return totalWin / (spins * betTotal);
}

async function calibrateToTarget(targetRtp, onProgress) {
  const estimateSpins = 25000;
  const refineSpins = 60000;

  onProgress(0.05, "Estimando RTP das tiras atuais…");
  const baseRtp = await estimateRtpForTable(BASE_PAYTABLE, estimateSpins, 999);
  if (baseRtp <= 0) return { table: deepCopyPaytable(BASE_PAYTABLE), rtp: 0, scale: 1 };

  let lo = Math.max(0.2, (targetRtp / baseRtp) * 0.5);
  let hi = Math.min(5, (targetRtp / baseRtp) * 1.5);
  let bestScale = targetRtp / baseRtp;
  let bestTable = scalePaytable(BASE_PAYTABLE, bestScale);
  let bestRtp = await estimateRtpForTable(bestTable, refineSpins, 321);
  let bestErr = Math.abs(bestRtp - targetRtp);

  onProgress(0.2, `Busca binária (base ${formatPct(baseRtp)})…`);

  for (let it = 0; it < 12; it++) {
    const mid = (lo + hi) / 2;
    const midTable = scalePaytable(BASE_PAYTABLE, mid);
    const midRtp = await estimateRtpForTable(midTable, estimateSpins, 500 + it);
    const err = midRtp - targetRtp;

    onProgress(0.2 + (it / 12) * 0.75, `Iter ${it + 1}/12 · escala ${mid.toFixed(3)} · RTP ${formatPct(midRtp)}`);

    if (Math.abs(err) < bestErr) {
      bestErr = Math.abs(err);
      bestScale = mid;
      bestTable = midTable;
      bestRtp = midRtp;
    }
    if (err < 0) lo = mid;
    else hi = mid;
    await yieldToMain();
  }

  bestRtp = await estimateRtpForTable(bestTable, refineSpins, 777);
  return { table: bestTable, rtp: bestRtp, scale: bestScale };
}

function openCalibOverlay(targetPct) {
  document.getElementById("overlay-calib").classList.remove("hidden");
  document.getElementById("calib-title").textContent = `Recalibrando para ${targetPct}%`;
  document.getElementById("calib-target-text").textContent =
    `Alvo RTP ${targetPct}% · House Edge ~${(100 - targetPct).toFixed(1)}%`;
  document.getElementById("calib-progress-bar").style.width = "0%";
  document.getElementById("calib-progress-text").textContent = "Iniciando…";
  document.getElementById("btn-calib-close").disabled = true;
}

async function startCalibration(targetPct) {
  if (calibState.running || rtpSimState.running || isSpinning) return;

  stopAuto();
  setToolsBlocked(true);

  if (targetPct === 92) {
    const est = await estimateRtpForTable(BASE_PAYTABLE, 20000, 42);
    if (Math.abs(est - 0.92) < 0.03) {
      resetPaytableToBase();
      setToolsBlocked(false);
      auditLog(`RTP_92 tiras≈${formatPct(est)} paytable reset ×1.0`);
      alert(
        `Tiras já próximas de 92% (simulação rápida: ${formatPct(est)}).\n` +
          `Paytable resetada para ×1.0. Rode o Teste RTP novamente.`
      );
      return;
    }
  }

  calibState.running = true;
  openCalibOverlay(targetPct);

  try {
    const targetRtp = targetPct / 100;
    const result = await calibrateToTarget(targetRtp, (p, msg) => {
      document.getElementById("calib-progress-bar").style.width = `${p * 100}%`;
      document.getElementById("calib-progress-text").textContent = msg;
    });

    paytable = result.table;
    paytableScale = result.scale;
    currentRtpProfile = `${targetPct}%`;
    updateMeters();

    document.getElementById("calib-progress-text").textContent =
      `Concluído · escala ${result.scale.toFixed(4)} · RTP estimado ${formatPct(result.rtp)} · House Edge ${formatPct(houseEdgeFromRtp(result.rtp))}`;

    auditLog(
      `CALIB target=${targetPct}% scale=${result.scale.toFixed(4)} rtp_est=${formatPct(result.rtp)}`
    );
  } catch (e) {
    document.getElementById("calib-progress-text").textContent = `Erro: ${e.message}`;
  } finally {
    calibState.running = false;
    isSpinning = false;
    setToolsBlocked(false);
    refreshControlsState();
    document.getElementById("btn-calib-close").disabled = false;
  }
}

// --- Eventos ---

function bindEvents() {
  document.getElementById("spin-button").addEventListener("click", handleSpin);
  document.getElementById("btn-buy-scatters")?.addEventListener("click", handleBuyScatters);
  document.getElementById("btn-auto").addEventListener("click", toggleAuto);

  document.querySelectorAll(".btn-bet").forEach((btn) => {
    btn.addEventListener("click", () => {
      setBetAmount(Number(btn.dataset.bet));
    });
  });

  document.querySelectorAll(".btn-auto-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const count = parseInt(btn.dataset.autoCount, 10);
      startAutoWithCount(count);
    });
  });
  document.getElementById("btn-auto-cancel").addEventListener("click", closeAutoOverlay);

  document.getElementById("btn-rtp-test").addEventListener("click", startRtpTest);
  document.getElementById("btn-rtp-cancel").addEventListener("click", () => {
    rtpSimState.cancel = true;
  });
  document.getElementById("btn-rtp-close").addEventListener("click", () => {
    document.getElementById("overlay-rtp").classList.add("hidden");
    rtpSimState.running = false;
    isSpinning = false;
    refreshControlsState();
  });

  document.getElementById("btn-rtp-92").addEventListener("click", () => startCalibration(92));
  document.getElementById("btn-rtp-95").addEventListener("click", () => startCalibration(95));

  document.getElementById("btn-calib-close").addEventListener("click", () => {
    document.getElementById("overlay-calib").classList.add("hidden");
  });

  const auditBtn = document.getElementById("btn-audit");
  const auditPanel = document.getElementById("audit-panel");

  auditBtn.addEventListener("click", () => {
    auditEnabled = !auditEnabled;
    auditBtn.classList.toggle("active", auditEnabled);
    auditBtn.setAttribute("aria-pressed", String(auditEnabled));
    auditPanel.classList.toggle("hidden", !auditEnabled);
    auditLog(auditEnabled ? "Auditoria ATIVADA" : "Auditoria DESATIVADA");
  });

  document.getElementById("btn-audit-clear").addEventListener("click", () => {
    document.getElementById("audit-log").innerHTML = "";
  });
}

window.WarcraftSlots = {
  applyState(data) {
    if (data.balance != null) balance = Number(data.balance);
    if (data.last_win != null) lastWin = Number(data.last_win);
    if (data.bet_total != null && BET_OPTIONS.includes(Number(data.bet_total))) {
      betTotal = Number(data.bet_total);
    }
    if (data.fs_remaining != null) fsRemaining = Number(data.fs_remaining);
    if (data.spin_counter != null) spinCounter = Number(data.spin_counter);
    if (data.paid_spin_counter != null) paidSpinCounter = Number(data.paid_spin_counter);
    if (data.paytable_scale != null) {
      paytableScale = Number(data.paytable_scale);
      paytable = scalePaytable(BASE_PAYTABLE, paytableScale);
    }
    if (data.rtp_profile) currentRtpProfile = data.rtp_profile;
    updateMeters();
    updateBetButtons();
  },
  getState() {
    return {
      balance,
      lastWin,
      betTotal,
      fsRemaining,
      spinCounter,
      paidSpinCounter,
      paytableScale,
      rtpProfile: currentRtpProfile,
    };
  },
};

function bootGame() {
  resetPaytableToBase();
  initReels();
  bindEvents();
  const initial = spinReels();
  renderWindow(initial);
  updateMeters();
  initDealerScatterBuyUI();
}

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("gameauth-ready", (ev) => {
    applyDealerScatterBuyUI(ev.detail?.isDealer);
  });

  if (window.GameAuth) {
    GameAuth.whenReady().then(bootGame);
  } else {
    bootGame();
  }
});
