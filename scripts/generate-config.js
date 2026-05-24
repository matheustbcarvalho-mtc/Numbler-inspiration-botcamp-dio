/**
 * Gera config.js a partir das variáveis de ambiente (Vercel).
 * Local: defina SUPABASE_URL e SUPABASE_ANON_KEY ou edite config.js manualmente.
 */
const fs = require("fs");
const path = require("path");

const url =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const key =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const dealerCode = process.env.DEALER_SIGNUP_CODE || "";
const requireDealer =
  process.env.REQUIRE_DEALER_ACCESS !== "false" &&
  process.env.REQUIRE_DEALER_ACCESS !== "0";

const out = `// Gerado automaticamente — não edite manualmente no deploy Vercel
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
window.REQUIRE_DEALER_ACCESS = ${requireDealer};
window.DEALER_SIGNUP_CODE = ${JSON.stringify(dealerCode)};
`;

const target = path.join(__dirname, "..", "config.js");
fs.writeFileSync(target, out, "utf8");
console.log(
  key && url
    ? "config.js gerado com credenciais Supabase."
    : "config.js gerado vazio — configure SUPABASE_URL e SUPABASE_ANON_KEY na Vercel."
);
