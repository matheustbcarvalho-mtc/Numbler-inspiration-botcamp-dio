// Copie para config.js e preencha com Settings → API do Supabase.
// Na Vercel, use variáveis SUPABASE_URL e SUPABASE_ANON_KEY (geradas no deploy).

window.SUPABASE_URL = "https://pcvbboostbgvvxhapsec.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_COLE_A_CHAVE_AQUI";

// Bloqueia o site em *.vercel.app — só dealers logados
window.REQUIRE_DEALER_ACCESS = true;

// Código para criar conta dealer (defina na Vercel: DEALER_SIGNUP_CODE)
window.DEALER_SIGNUP_CODE = "SEU_CODIGO_SECRETO";
