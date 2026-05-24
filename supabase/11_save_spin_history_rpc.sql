-- Obsoleto: use supabase/13_historico_rodar_este.sql
-- Salva giros no histórico mesmo com RLS restritivo (security definer)
-- Execute no SQL Editor do Supabase

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
  values (
    v_uid,
    v_email,
    coalesce(v_name, split_part(v_email, '@', 1))
  )
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
        user_id,
        spin_number,
        kind,
        bet_total,
        total_win,
        balance_before,
        balance_after,
        reel_window,
        scatter_count,
        fs_awarded,
        fs_remaining_after,
        paytable_scale,
        rtp_profile,
        player_email,
        player_display_name
      ) values (
        v_uid,
        v_spin_number,
        p_kind,
        coalesce(p_bet_total, 0),
        coalesce(p_total_win, 0),
        p_balance_before,
        p_balance_after,
        p_reel_window,
        coalesce(p_scatter_count, 0),
        coalesce(p_fs_awarded, 0),
        coalesce(p_fs_remaining_after, 0),
        coalesce(p_paytable_scale, 1),
        p_rtp_profile,
        v_email,
        v_name
      )
      returning id into v_spin_id;
      exit;
    exception
      when unique_violation then
        v_spin_number := v_spin_number + 1;
        if v_attempt >= 10 then
          raise;
        end if;
    end;
  end loop;

  for v_win in select * from jsonb_array_elements(coalesce(p_line_wins, '[]'::jsonb))
  loop
    insert into public.spin_line_wins (
      spin_id,
      line_index,
      target_symbol,
      match_count,
      payout
    ) values (
      v_spin_id,
      (v_win ->> 'lineIndex')::smallint,
      v_win ->> 'target',
      (v_win ->> 'matchCount')::smallint,
      (v_win ->> 'payout')::numeric
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'spin_id', v_spin_id,
    'spin_number', v_spin_number
  );
end;
$$;

grant execute on function public.save_spin_history to authenticated;

-- Políticas diretas (caso prefira insert sem RPC)
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

grant select, insert on public.spins to authenticated;
grant select, insert on public.spin_line_wins to authenticated;
