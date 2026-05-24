-- Obsoleto: use supabase/08_fix_historico_definitivo.sql (mais completo)
-- Fix completo: histórico + dealer + colunas que faltam
-- Execute TUDO de uma vez no SQL Editor do Supabase

-- 1) Colunas que podem faltar
alter table public.profiles add column if not exists email text;

alter table public.spins
  add column if not exists player_email text,
  add column if not exists player_display_name text;

-- 2) Sincronizar e-mail dos perfis
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id;

-- 3) Tornar você dealer (usa auth.users, não precisa da coluna email antes)
update public.profiles p
set role = 'dealer',
    email = 'matheus.tbcarvalho@gmail.com'
from auth.users u
where p.id = u.id
  and u.email = 'matheus.tbcarvalho@gmail.com';

-- 4) Políticas para salvar e ler giros
drop policy if exists "Giros: inserção própria" on public.spins;
create policy "Giros: inserção própria"
  on public.spins for insert
  with check (auth.uid() = user_id);

drop policy if exists "Giros: leitura todos dealers" on public.spins;
create policy "Giros: leitura todos dealers"
  on public.spins for select
  using (public.is_dealer());

drop policy if exists "Perfis: leitura dealer" on public.profiles;
create policy "Perfis: leitura dealer"
  on public.profiles for select
  using (public.is_dealer());

-- 5) Conferir (deve retornar 1 linha com role = dealer)
select id, display_name, email, role
from public.profiles
where email = 'matheus.tbcarvalho@gmail.com';
