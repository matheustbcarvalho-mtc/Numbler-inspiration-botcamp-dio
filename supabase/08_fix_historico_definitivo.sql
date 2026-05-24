-- Histórico vazio: execute ESTE arquivo inteiro no SQL Editor do Supabase
-- (substitui/complementa 06 e 07)

-- 1) Tipos e colunas que podem faltar
do $$ begin
  create type public.user_role as enum ('player', 'dealer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.spin_kind as enum ('paid', 'free');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists email text,
  add column if not exists role public.user_role not null default 'player';

-- Coluna antiga "window" → reel_window
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'spins' and column_name = 'window'
  ) then
    alter table public.spins rename column "window" to reel_window;
  end if;
end $$;

alter table public.spins
  add column if not exists reel_window jsonb,
  add column if not exists player_email text,
  add column if not exists player_display_name text;

-- 2) Função is_dealer (usada nas políticas)
create or replace function public.is_dealer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'dealer'::public.user_role
  );
$$;

-- 3) Sincronizar e-mail e tornar você dealer
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

update public.profiles p
set role = 'dealer'::public.user_role,
    email = coalesce(p.email, u.email)
from auth.users u
where p.id = u.id
  and u.email = 'matheus.tbcarvalho@gmail.com';

-- 4) Políticas de spins (insert + leitura própria + leitura dealer)
drop policy if exists "Giros: inserção própria" on public.spins;
drop policy if exists "Giros: inserção dealer" on public.spins;
drop policy if exists "Giros: leitura própria" on public.spins;
drop policy if exists "Giros: leitura todos dealers" on public.spins;

create policy "Giros: inserção própria"
  on public.spins for insert
  with check (auth.uid() = user_id);

create policy "Giros: leitura própria"
  on public.spins for select
  using (auth.uid() = user_id);

create policy "Giros: leitura todos dealers"
  on public.spins for select
  using (public.is_dealer());

-- 5) Linhas de ganho (insert após o giro)
drop policy if exists "Linhas: inserção via giro próprio" on public.spin_line_wins;
create policy "Linhas: inserção via giro próprio"
  on public.spin_line_wins for insert
  with check (
    exists (
      select 1 from public.spins s
      where s.id = spin_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Linhas: leitura via giro próprio" on public.spin_line_wins;
create policy "Linhas: leitura via giro próprio"
  on public.spin_line_wins for select
  using (
    exists (
      select 1 from public.spins s
      where s.id = spin_id and s.user_id = auth.uid()
    )
  );

-- 6) Perfis visíveis para dealers (join no histórico)
drop policy if exists "Perfis: leitura dealer" on public.profiles;
create policy "Perfis: leitura dealer"
  on public.profiles for select
  using (public.is_dealer());

grant select, insert on public.spins to authenticated;
grant select, insert on public.spin_line_wins to authenticated;

-- 7) Conferência (deve mostrar role = dealer)
select p.id, p.email, p.role, p.display_name
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'matheus.tbcarvalho@gmail.com';
