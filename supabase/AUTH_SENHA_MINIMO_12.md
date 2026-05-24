# Senha mínima (legado)

> Atual: **13 caracteres** no site. Documentação geral: **`ESTRUTURA_SUPABASE.md`**

# Senha mínima: 12 caracteres

A regra de senha fica no **painel do Supabase** (não dá para mudar só pelo SQL).

## Passos

1. Abra [Supabase Dashboard](https://supabase.com/dashboard) → projeto **pcvbboostbgvvxhapsec**
2. Menu **Authentication** → **Providers** (ou **Sign In / Providers**)
3. Clique em **Email**
4. Em **Password requirements** (ou **Minimum password length**), altere de **20** para **12**
5. Clique em **Save**

Depois disso, senhas como `2e3fbg2e3fbg` (12 caracteres) passam no cadastro.

O site (`login.html` + `auth-page.js`) já valida **mínimo 12** no front.
