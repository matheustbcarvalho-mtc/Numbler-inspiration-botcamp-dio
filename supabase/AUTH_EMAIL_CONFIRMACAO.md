# Erro: "Error sending confirmation email"

## O que acontece

Com **Confirm email** ligado e **SMTP não configurado**, o Supabase:

1. **Não envia** o e-mail  
2. **Não cria** o usuário em Authentication → Users  
3. **Não cria** linha em `profiles` (o trigger só roda depois do usuário em `auth.users`)

Por isso o cadastro pelo site falha por completo — não adianta esperar o e-mail.

---

## Solução obrigatória (bootcamp / testes)

1. Abra [Supabase Dashboard](https://supabase.com/dashboard) → projeto **pcvbboostbgvvxhapsec**
2. Menu **Authentication**
3. Aba **Sign In / Providers** (ou só **Providers**)
4. Clique em **Email**
5. **Desligue** a opção **Confirm email** (também pode aparecer como *Enable email confirmations*)
6. Clique em **Save**

Espere ~30 segundos e tente **Criar conta** de novo no site.

---

## Criar usuário manualmente (alternativa)

Se ainda não funcionar pelo site:

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. E-mail: `mtc.mat.30@gmail.com`
3. Senha: (a que o jogador vai usar, mín. 13 caracteres no Supabase)
4. Marque **Auto Confirm User**
5. **Create user**

Depois rode no **SQL Editor** (se `profiles` não aparecer):

```sql
insert into public.profiles (id, email, display_name, role)
select id, email, 'matheus.mtc30', 'dealer'::public.user_role
from auth.users
where email = 'mtc.mat.30@gmail.com'
on conflict (id) do update
set display_name = excluded.display_name, role = excluded.role;

insert into public.player_game_state (user_id)
select id from auth.users where email = 'mtc.mat.30@gmail.com'
on conflict do nothing;
```

---

## Produção (e-mail de verdade)

**Project Settings** → **Authentication** → **SMTP Settings**  
Configure SendGrid, Resend, Gmail SMTP, etc., **e** mantenha **Confirm email** ligado.
