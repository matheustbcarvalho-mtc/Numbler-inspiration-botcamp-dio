/**
 * Gera config.js a partir das variáveis de ambiente (Vercel).
 * Local: copie config.example.js → config.js ou exporte as variáveis antes do build.
 */
const fs = require("fs");
const path = require("path");

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
const requireDealer =
  process.env.REQUIRE_DEALER_ACCESS !== "false" &&
  process.env.REQUIRE_DEALER_ACCESS !== "0";

const isVercel = Boolean(process.env.VERCEL);

if (isVercel && (!url || !key)) {
  console.error("\n[build] ERRO: variáveis obrigatórias ausentes na Vercel.\n");
  console.error("  Defina em Settings → Environment Variables (Production):");
  console.error("    SUPABASE_URL          = https://SEU_PROJETO.supabase.co");
  console.error("    SUPABASE_ANON_KEY     = sb_publishable_... ou chave anon eyJ...");
  console.error("    DEALER_SIGNUP_CODE    = (opcional) código para cadastro dealer");
  console.error("\n  Depois: Deployments → Redeploy (sem cache).\n");
  process.exit(1);
}

const out = `// Gerado automaticamente — não edite manualmente no deploy Vercel
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
window.REQUIRE_DEALER_ACCESS = ${requireDealer};
window.DEALER_SIGNUP_CODE = ${JSON.stringify(dealerCode)};
`;

const target = path.join(__dirname, "..", "config.js");
fs.writeFileSync(target, out, "utf8");

if (url && key) {
  console.log("[build] config.js OK — Supabase configurado.");
} else {
  console.warn("[build] config.js gerado vazio (desenvolvimento local).");
}
