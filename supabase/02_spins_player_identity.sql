-- Execute no SQL Editor do Supabase (projeto já com schema v2 aplicado).
-- Adiciona nome e e-mail em cada giro para consulta por jogador.

alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.email is 'Cópia do e-mail do auth.users para relatórios.';

alter table public.spins
  add column if not exists player_email text,
  add column if not exists player_display_name text;

comment on column public.spins.player_email is 'E-mail do jogador no momento do giro.';
comment on column public.spins.player_display_name is 'Nome exibido do jogador no momento do giro.';

create index if not exists spins_player_email_idx on public.spins (player_email);
create index if not exists spins_player_name_idx on public.spins (player_display_name);

-- Sincroniza e-mail nos perfis existentes (requer permissão service role no SQL Editor — ok no dashboard)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email <> u.email);

-- Atualiza trigger de novo usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );

  insert into public.player_game_state (user_id)
  values (new.id);

  return new;
end;
$$;

-- View para listar giros por jogador (Table Editor / relatórios)
create or replace view public.spins_by_player as
select
  s.id,
  s.spin_number,
  s.player_display_name,
  s.player_email,
  s.kind,
  s.bet_total,
  s.total_win,
  s.balance_before,
  s.balance_after,
  s.scatter_count,
  s.fs_awarded,
  s.fs_remaining_after,
  s.created_at
from public.spins s
order by s.created_at desc;

alter view public.spins_by_player set (security_invoker = true);
grant select on public.spins_by_player to authenticated;

-- Permite o jogador atualizar o próprio perfil (nome/e-mail)
drop policy if exists "Perfis: inserção própria" on public.profiles;
create policy "Perfis: inserção própria"
  on public.profiles for insert
  with check (auth.uid() = id);
