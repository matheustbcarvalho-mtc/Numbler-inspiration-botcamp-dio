-- Execute PRIMEIRO se uma migração anterior falhou ou ficou pela metade.
-- Depois execute schema.sql (v2, com reel_window).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.record_spin(
  public.spin_kind,
  numeric,
  numeric,
  jsonb,
  smallint,
  integer,
  jsonb
);
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

drop view if exists public.player_stats;

drop table if exists public.spin_line_wins cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.rtp_simulation_runs cascade;
drop table if exists public.spins cascade;
drop table if exists public.player_game_state cascade;
drop table if exists public.game_config cascade;
drop table if exists public.profiles cascade;

drop type if exists public.spin_kind cascade;
drop type if exists public.symbol_code cascade;
