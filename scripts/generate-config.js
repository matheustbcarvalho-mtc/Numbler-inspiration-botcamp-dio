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

const target = path.join(__dirname, "..", "config.js");

function existingConfigIsValid() {
  if (!fs.existsSync(target)) return false;
  const text = fs.readFileSync(target, "utf8");
  return (
    text.includes(".supabase.co") &&
    (text.includes("eyJ") || text.includes("sb_publishable_"))
  );
}

// Sem env na Vercel: usa config.js commitado no repositório
if (!url || !key) {
  if (existingConfigIsValid()) {
    console.log("[build] Usando config.js do repositório (env Vercel vazias).");
    process.exit(0);
  }
  if (process.env.VERCEL) {
    console.error("\n[build] ERRO: sem env vars e sem config.js válido no repo.\n");
    process.exit(1);
  }
  console.warn("[build] config.js ausente ou vazio — copie config.example.js");
  process.exit(0);
}

const out = `// Gerado no build a partir das env vars (Vercel)
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
window.REQUIRE_DEALER_ACCESS = ${requireDealer};
window.DEALER_SIGNUP_CODE = ${JSON.stringify(dealerCode)};
`;

fs.writeFileSync(target, out, "utf8");
console.log("[build] config.js gerado das variáveis de ambiente.");
