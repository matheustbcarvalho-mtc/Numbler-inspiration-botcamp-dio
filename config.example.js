// Copie para config.js e preencha com Settings → API do Supabase.
// Na Vercel, use variáveis SUPABASE_URL e SUPABASE_ANON_KEY (geradas no deploy).

window.SUPABASE_URL = "https://pcvbboostbgvvxhapsec.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_COLE_A_CHAVE_AQUI";

// Em *.vercel.app exige login (jogadores e dealers)
window.REQUIRE_DEALER_ACCESS = true;

// Opcional no cadastro: com código correto vira dealer; sem código = jogador
window.DEALER_SIGNUP_CODE = "SEU_CODIGO_SECRETO";
