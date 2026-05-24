/**
 * Gera config.js a partir das variáveis de ambiente (opcional).
 * Na Vercel o config.js commitado no repo já é usado (sem build obrigatório).
 */
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "config.js");

const url = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();

const key = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ""
).trim();

const dealerCode = (process.env.DEALER_SIGNUP_CODE || "").trim();

function parseExistingScatterEmails() {
  if (!fs.existsSync(target)) return [];
  const text = fs.readFileSync(target, "utf8");
  const m = text.match(/DEALER_SCATTER_BUY_EMAILS\s*=\s*(\[[\s\S]*?\])/);
  if (!m) return [];
  try {
    return JSON.parse(m[1].replace(/'/g, '"'));
  } catch {
    return [];
  }
}

const scatterFromEnv = (process.env.DEALER_SCATTER_BUY_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const scatterBuyEmails =
  scatterFromEnv.length > 0 ? scatterFromEnv : parseExistingScatterEmails();
const requireDealer =
  process.env.REQUIRE_DEALER_ACCESS !== "false" &&
  process.env.REQUIRE_DEALER_ACCESS !== "0";

function existingConfigIsValid() {
  if (!fs.existsSync(target)) return false;
  const text = fs.readFileSync(target, "utf8");
  return (
    text.includes(".supabase.co") &&
    (text.includes("eyJ") || text.includes("sb_publishable_"))
  );
}

if (!url || !key) {
  if (existingConfigIsValid()) {
    console.log("[build] Mantendo config.js do repositório.");
  } else {
    console.warn("[build] config.js inválido — edite config.js ou defina env vars.");
  }
  process.exit(0);
}

const out = `// Gerado no build a partir das env vars
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
window.REQUIRE_DEALER_ACCESS = ${requireDealer};
window.DEALER_SIGNUP_CODE = ${JSON.stringify(dealerCode)};
window.DEALER_SCATTER_BUY_EMAILS = ${JSON.stringify(scatterBuyEmails)};
`;

fs.writeFileSync(target, out, "utf8");
console.log("[build] config.js atualizado pelas variáveis de ambiente.");
process.exit(0);
