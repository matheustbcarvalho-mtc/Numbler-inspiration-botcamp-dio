-- =============================================================================
-- Warcraft Rumble Slots — Schema Supabase (v2)
-- Cole TODO este arquivo no SQL Editor e execute de uma vez.
-- v2: coluna reel_window (WINDOW é palavra reservada no PostgreSQL — não use "window")
-- Antes de rodar de novo: execute supabase/00_drop.sql se uma tentativa anterior falhou pela metade.
-- =============================================================================

-- Extensões
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

create type public.spin_kind as enum ('paid', 'free');

create type public.symbol_code as enum (
  'P1', 'P2', 'Wild', 'A', 'K', 'Q', 'J', '10', '9', 'Scatter'
);

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Dados públicos do jogador vinculados ao Supabase Auth.';

-- -----------------------------------------------------------------------------
-- Estado atual da partida (espelha variáveis em script.js)
-- -----------------------------------------------------------------------------

create table public.player_game_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance numeric(12, 2) not null default 1000.00
    check (balance >= 0),
  last_win numeric(12, 2) not null default 0.00
    check (last_win >= 0),
  bet_total numeric(12, 2) not null default 5.00
    check (bet_total in (5, 10, 20, 50)),
  fs_remaining integer not null default 0
    check (fs_remaining >= 0),
  paytable_scale numeric(6, 4) not null default 1.0000
    check (paytable_scale > 0),
  rtp_profile text not null default '92% (tiras ×1.0)',
  spin_counter bigint not null default 0
    check (spin_counter >= 0),
  paid_spin_counter bigint not null default 0
    check (paid_spin_counter >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.player_game_state is
  'Saldo, aposta, free spins e contadores — equivalente ao estado em memória do cliente.';

-- -----------------------------------------------------------------------------
-- Histórico de giros
-- -----------------------------------------------------------------------------

create table public.spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  spin_number bigint not null,
  kind public.spin_kind not null,
  bet_total numeric(12, 2) not null default 0
    check (bet_total >= 0),
  bet_per_line numeric(12, 2) generated always as (bet_total / 5) stored,
  total_win numeric(12, 2) not null default 0
    check (total_win >= 0),
  balance_before numeric(12, 2) not null,
  reel_window jsonb not null, -- linha 77: não use "window" (palavra reservada no PostgreSQL)
  balance_after numeric(12, 2) not null,
  scatter_count smallint not null default 0
    check (scatter_count >= 0 and scatter_count <= 15),
  fs_awarded integer not null default 0
    check (fs_awarded >= 0),
  fs_remaining_after integer not null default 0
    check (fs_remaining_after >= 0),
  paytable_scale numeric(6, 4) not null default 1.0000,
  rtp_profile text,
  player_email text,
  player_display_name text,
  created_at timestamptz not null default now(),

  constraint spins_reel_window_shape check (
    jsonb_typeof(reel_window) = 'array'
    and jsonb_array_length(reel_window) = 5
  ),
  constraint spins_user_spin_unique unique (user_id, spin_number)
);

comment on table public.spins is
  'Cada giro (pago ou free). reel_window: array de 5 colunas × 3 símbolos, ex.: [["9","K","Q"], ...].';

comment on column public.spins.reel_window is
  'Grade 5×3. Símbolos: P1, P2, Wild, A, K, Q, J, 10, 9, Scatter.';

create index spins_user_created_idx on public.spins (user_id, created_at desc);
create index spins_user_kind_idx on public.spins (user_id, kind);
create index spins_player_email_idx on public.spins (player_email);
create index spins_player_name_idx on public.spins (player_display_name);

-- -----------------------------------------------------------------------------
-- Ganhos por linha (paylines 1–5)
-- -----------------------------------------------------------------------------

create table public.spin_line_wins (
  id uuid primary key default gen_random_uuid(),
  spin_id uuid not null references public.spins (id) on delete cascade,
  line_index smallint not null
    check (line_index between 1 and 5),
  target_symbol text not null,
  match_count smallint not null
    check (match_count between 3 and 5),
  payout numeric(12, 2) not null
    check (payout >= 0)
);

create index spin_line_wins_spin_idx on public.spin_line_wins (spin_id);

-- -----------------------------------------------------------------------------
-- Sessões de simulação RTP (botões Teste RTP / Calibração)
-- -----------------------------------------------------------------------------

create table public.rtp_simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  target_rtp_pct smallint,
  spins_requested integer not null
    check (spins_requested > 0),
  spins_completed integer not null default 0,
  bet_total numeric(12, 2) not null,
  total_bet numeric(14, 2),
  total_win numeric(14, 2),
  rtp_ratio numeric(8, 6),
  hit_rate numeric(8, 6),
  house_edge numeric(8, 6),
  rtp_ci95_low numeric(8, 6),
  rtp_ci95_high numeric(8, 6),
  max_win numeric(12, 2),
  paytable_scale numeric(6, 4),
  seed integer,
  canceled boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index rtp_simulation_runs_user_idx on public.rtp_simulation_runs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Log de auditoria (espelha painel Auditoria do front)
-- -----------------------------------------------------------------------------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  spin_id uuid references public.spins (id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_user_created_idx on public.audit_events (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Configuração de referência (paytable base — somente leitura no app)
-- -----------------------------------------------------------------------------

create table public.game_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.game_config (key, value, description) values
  (
    'bet_options',
    '[5, 10, 20, 50]'::jsonb,
    'Apostas totais permitidas (R$), divididas por 5 linhas.'
  ),
  (
    'initial_balance',
    '1000.00'::jsonb,
    'Saldo inicial de novos jogadores.'
  ),
  (
    'base_paytable',
    '{
      "P1": {"3": 565, "4": 2260, "5": 11300},
      "P2": {"3": 226, "4": 1130, "5": 5650},
      "A":  {"3": 113, "4": 565,  "5": 2260},
      "K":  {"3": 56,  "4": 226,  "5": 1130},
      "Q":  {"3": 23,  "4": 113,  "5": 565},
      "J":  {"3": 11,  "4": 56,   "5": 226},
      "10": {"3": 6,   "4": 23,   "5": 113},
      "9":  {"3": 2,   "4": 11,   "5": 56}
    }'::jsonb,
    'Paytable base (×1.0) — script.js BASE_PAYTABLE.'
  ),
  (
    'scatter_fs_awards',
    '{"3": 10, "4": 15, "5": 20}'::jsonb,
    'Free spins concedidos por quantidade de Scatter.'
  ),
  (
    'paylines',
    '[
      [1,1,1,1,1],
      [0,0,0,0,0],
      [2,2,2,2,2],
      [0,1,2,1,0],
      [2,1,0,1,2]
    ]'::jsonb,
    'Índices de linha (0=topo, 1=centro, 2=baixo) por coluna.'
  );

-- -----------------------------------------------------------------------------
-- Triggers: updated_at
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger player_game_state_set_updated_at
  before update on public.player_game_state
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Novo usuário: perfil + estado inicial
-- -----------------------------------------------------------------------------

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RPC: registrar giro (opcional — chamar do front após validar no servidor)
-- -----------------------------------------------------------------------------

create or replace function public.record_spin(
  p_kind public.spin_kind,
  p_bet_total numeric,
  p_total_win numeric,
  p_reel_window jsonb,
  p_scatter_count smallint default 0,
  p_fs_awarded integer default 0,
  p_line_wins jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_state public.player_game_state%rowtype;
  v_spin_id uuid;
  v_spin_number bigint;
  v_balance_before numeric(12, 2);
  v_balance_after numeric(12, 2);
  v_debit numeric(12, 2);
  v_win jsonb;
  v_line jsonb;
  v_email text;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select email into v_email from auth.users where id = v_user_id;
  select display_name into v_name from public.profiles where id = v_user_id;

  select * into v_state
  from public.player_game_state
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Estado do jogo não encontrado';
  end if;

  v_balance_before := v_state.balance;
  v_debit := case when p_kind = 'paid' then p_bet_total else 0 end;

  if p_kind = 'paid' and v_state.fs_remaining <= 0 then
    if v_balance_before < p_bet_total then
      raise exception 'Saldo insuficiente';
    end if;
    v_balance_after := v_balance_before - p_bet_total + p_total_win;
  elsif p_kind = 'free' then
    if v_state.fs_remaining <= 0 then
      raise exception 'Sem free spins disponíveis';
    end if;
    v_balance_after := v_balance_before + p_total_win;
    v_state.fs_remaining := v_state.fs_remaining - 1;
  else
    v_balance_after := v_balance_before + p_total_win;
  end if;

  v_spin_number := v_state.spin_counter + 1;

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
    v_user_id,
    v_spin_number,
    p_kind,
    v_debit,
    p_total_win,
    v_balance_before,
    v_balance_after,
    p_reel_window,
    p_scatter_count,
    p_fs_awarded,
    v_state.fs_remaining + p_fs_awarded,
    v_state.paytable_scale,
    v_state.rtp_profile,
    v_email,
    v_name
  )
  returning id into v_spin_id;

  for v_win in select * from jsonb_array_elements(p_line_wins)
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

  update public.player_game_state
  set
    balance = v_balance_after,
    last_win = p_total_win,
    bet_total = case when p_kind = 'paid' then p_bet_total else bet_total end,
    fs_remaining = fs_remaining + p_fs_awarded - case when p_kind = 'free' then 1 else 0 end,
    spin_counter = v_spin_number,
    paid_spin_counter = paid_spin_counter + case when p_kind = 'paid' then 1 else 0 end,
    updated_at = now()
  where user_id = v_user_id;

  return v_spin_id;
end;
$$;

comment on function public.record_spin is
  'Persiste um giro e atualiza saldo/FS. p_line_wins: [{lineIndex,target,matchCount,payout}, ...].';

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.player_game_state enable row level security;
alter table public.spins enable row level security;
alter table public.spin_line_wins enable row level security;
alter table public.rtp_simulation_runs enable row level security;
alter table public.audit_events enable row level security;
alter table public.game_config enable row level security;

-- profiles
create policy "Perfis: leitura própria"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Perfis: atualização própria"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Perfis: inserção própria"
  on public.profiles for insert
  with check (auth.uid() = id);

-- player_game_state
create policy "Estado: leitura própria"
  on public.player_game_state for select
  using (auth.uid() = user_id);

create policy "Estado: atualização própria"
  on public.player_game_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- spins
create policy "Giros: leitura própria"
  on public.spins for select
  using (auth.uid() = user_id);

create policy "Giros: inserção própria"
  on public.spins for insert
  with check (auth.uid() = user_id);

-- spin_line_wins (via spin do usuário)
create policy "Linhas: leitura via giro próprio"
  on public.spin_line_wins for select
  using (
    exists (
      select 1 from public.spins s
      where s.id = spin_id and s.user_id = auth.uid()
    )
  );

create policy "Linhas: inserção via giro próprio"
  on public.spin_line_wins for insert
  with check (
    exists (
      select 1 from public.spins s
      where s.id = spin_id and s.user_id = auth.uid()
    )
  );

-- rtp_simulation_runs
create policy "RTP runs: leitura própria"
  on public.rtp_simulation_runs for select
  using (user_id is null or auth.uid() = user_id);

create policy "RTP runs: inserção própria"
  on public.rtp_simulation_runs for insert
  with check (auth.uid() = user_id);

-- audit_events
create policy "Auditoria: leitura própria"
  on public.audit_events for select
  using (auth.uid() = user_id);

create policy "Auditoria: inserção própria"
  on public.audit_events for insert
  with check (auth.uid() = user_id);

-- game_config: leitura pública autenticada
create policy "Config: leitura para autenticados"
  on public.game_config for select
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Views úteis para dashboard / relatórios
-- -----------------------------------------------------------------------------

create or replace view public.player_stats as
select
  s.user_id,
  count(*) filter (where s.kind = 'paid') as paid_spins,
  count(*) filter (where s.kind = 'free') as free_spins,
  coalesce(sum(s.bet_total) filter (where s.kind = 'paid'), 0) as total_wagered,
  coalesce(sum(s.total_win), 0) as total_won,
  case
    when coalesce(sum(s.bet_total) filter (where s.kind = 'paid'), 0) > 0
    then coalesce(sum(s.total_win), 0) / sum(s.bet_total) filter (where s.kind = 'paid')
    else null
  end as observed_rtp,
  max(s.total_win) as max_single_win,
  max(s.created_at) as last_spin_at
from public.spins s
group by s.user_id;

comment on view public.player_stats is
  'RTP observado por jogador (giros pagos). Respeita RLS de spins (security_invoker).';

alter view public.player_stats set (security_invoker = true);

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

grant usage on schema public to anon, authenticated;
grant select on public.player_stats to authenticated;
grant select on public.spins_by_player to authenticated;
grant select on public.game_config to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, update on public.player_game_state to authenticated;
grant select, insert on public.spins to authenticated;
grant select, insert on public.spin_line_wins to authenticated;
grant select, insert on public.rtp_simulation_runs to authenticated;
grant select, insert on public.audit_events to authenticated;
grant execute on function public.record_spin to authenticated;
