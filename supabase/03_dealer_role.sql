-- Acesso restrito a dealers. Execute no SQL Editor do Supabase.

do $$ begin
  create type public.user_role as enum ('player', 'dealer');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists role public.user_role not null default 'player';

comment on column public.profiles.role is 'Somente dealer acessa o jogo em produção.';

-- Função para RLS
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

-- Giros: apenas dealers autenticados
drop policy if exists "Giros: inserção própria" on public.spins;
create policy "Giros: inserção dealer"
  on public.spins for insert
  with check (auth.uid() = user_id and public.is_dealer());

-- Estado do jogo: leitura/atualização só para dealer
drop policy if exists "Estado: leitura própria" on public.player_game_state;
drop policy if exists "Estado: atualização própria" on public.player_game_state;

create policy "Estado: leitura dealer"
  on public.player_game_state for select
  using (auth.uid() = user_id and public.is_dealer());

create policy "Estado: atualização dealer"
  on public.player_game_state for update
  using (auth.uid() = user_id and public.is_dealer())
  with check (auth.uid() = user_id and public.is_dealer());

-- Promover um usuário a dealer (troque o e-mail):
-- update public.profiles set role = 'dealer' where email = 'seu@email.com';
