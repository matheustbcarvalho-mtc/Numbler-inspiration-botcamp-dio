-- Corrige: column spins.player_email does not exist
-- Cole no SQL Editor do Supabase e execute.

alter table public.spins
  add column if not exists player_email text,
  add column if not exists player_display_name text;

create index if not exists spins_player_email_idx on public.spins (player_email);

-- Dealers veem nome/e-mail de outros jogadores no histórico
drop policy if exists "Perfis: leitura dealer" on public.profiles;
create policy "Perfis: leitura dealer"
  on public.profiles for select
  using (public.is_dealer());
