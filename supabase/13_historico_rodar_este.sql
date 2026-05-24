-- =============================================================================
-- HISTÓRICO DE GIROS — execute ESTE arquivo inteiro no SQL Editor
-- (substitui 07, 08, 11 para histórico; não rode 03_dealer_role.sql depois)
-- =============================================================================

-- Tipos
do $$ begin
  create type public.spin_kind as enum ('paid', 'free');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_role as enum ('player', 'dealer');
exception when duplicate_object then null;
end $$;

-- Colunas que podem faltar
alter table public.profiles
  add column if not exists email text,
  add column if not exists role public.user_role not null default 'player';

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

-- is_dealer (para dealers verem todo o histórico)
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

-- RPC: salva giro (ignora RLS; jogadores e dealers)
create or replace function public.save_spin_history(
  p_kind public.spin_kind,
  p_bet_total numeric,
  p_total_win numeric,
  p_balance_before numeric,
  p_balance_after numeric,
  p_reel_window jsonb,
  p_scatter_count smallint default 0,
  p_fs_awarded integer default 0,
  p_fs_remaining_after integer default 0,
  p_spin_number bigint default null,
  p_paytable_scale numeric default 1,
  p_rtp_profile text default null,
  p_line_wins jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_spin_id uuid;
  v_spin_number bigint;
  v_email text;
  v_name text;
  v_win jsonb;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  select p.display_name into v_name from public.profiles p where p.id = v_uid;

  insert into public.profiles (id, email, display_name)
  values (v_uid, v_email, coalesce(v_name, split_part(v_email, '@', 1)))
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      display_name = coalesce(excluded.display_name, public.profiles.display_name);

  select coalesce(max(s.spin_number), 0) + 1
  into v_spin_number
  from public.spins s
  where s.user_id = v_uid;

  if p_spin_number is not null and p_spin_number >= v_spin_number then
    v_spin_number := p_spin_number;
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.spins (
        user_id, spin_number, kind, bet_total, total_win,
        balance_before, balance_after, reel_window,
        scatter_count, fs_awarded, fs_remaining_after,
        paytable_scale, rtp_profile, player_email, player_display_name
      ) values (
        v_uid, v_spin_number, p_kind,
        coalesce(p_bet_total, 0), coalesce(p_total_win, 0),
        p_balance_before, p_balance_after, p_reel_window,
        coalesce(p_scatter_count, 0), coalesce(p_fs_awarded, 0),
        coalesce(p_fs_remaining_after, 0),
        coalesce(p_paytable_scale, 1), p_rtp_profile, v_email, v_name
      )
      returning id into v_spin_id;
      exit;
    exception
      when unique_violation then
        v_spin_number := v_spin_number + 1;
        if v_attempt >= 10 then raise; end if;
    end;
  end loop;

  begin
    for v_win in select * from jsonb_array_elements(coalesce(p_line_wins, '[]'::jsonb))
    loop
      insert into public.spin_line_wins (
        spin_id, line_index, target_symbol, match_count, payout
      ) values (
        v_spin_id,
        (v_win ->> 'lineIndex')::smallint,
        v_win ->> 'target',
        (v_win ->> 'matchCount')::smallint,
        (v_win ->> 'payout')::numeric
      );
    end loop;
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'spin_id', v_spin_id, 'spin_number', v_spin_number);
end;
$$;

grant execute on function public.save_spin_history to authenticated;
grant select, insert on public.spins to authenticated;
grant select, insert on public.spin_line_wins to authenticated;

-- Remover política antiga que bloqueia jogadores (só dealer inseria)
drop policy if exists "Giros: inserção dealer" on public.spins;
drop policy if exists "Giros: inserção própria" on public.spins;
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

-- Linhas de ganho
drop policy if exists "Linhas: inserção via giro próprio" on public.spin_line_wins;
drop policy if exists "Linhas: leitura via giro próprio" on public.spin_line_wins;

create policy "Linhas: inserção via giro próprio"
  on public.spin_line_wins for insert
  with check (
    exists (select 1 from public.spins s where s.id = spin_id and s.user_id = auth.uid())
  );

create policy "Linhas: leitura via giro próprio"
  on public.spin_line_wins for select
  using (
    exists (select 1 from public.spins s where s.id = spin_id and s.user_id = auth.uid())
  );

-- Saldo do jogo: jogadores também (se rodou 03 antes)
drop policy if exists "Estado: leitura própria" on public.player_game_state;
drop policy if exists "Estado: atualização própria" on public.player_game_state;

create policy "Estado: leitura própria"
  on public.player_game_state for select
  using (auth.uid() = user_id);

create policy "Estado: atualização própria"
  on public.player_game_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Conferência
select 'save_spin_history' as item, proname as ok
from pg_proc
where proname = 'save_spin_history';

select count(*) as total_giros from public.spins;
