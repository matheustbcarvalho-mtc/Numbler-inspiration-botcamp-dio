-- Jogadores (role = player) também leem/atualizam o próprio estado do jogo
-- Execute no SQL Editor se saldo não persistir para contas sem código dealer

drop policy if exists "Estado: leitura própria" on public.player_game_state;
drop policy if exists "Estado: atualização própria" on public.player_game_state;
drop policy if exists "Estado: leitura dealer" on public.player_game_state;
drop policy if exists "Estado: atualização dealer" on public.player_game_state;

create policy "Estado: leitura própria"
  on public.player_game_state for select
  using (auth.uid() = user_id);

create policy "Estado: atualização própria"
  on public.player_game_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Estado: leitura dealer"
  on public.player_game_state for select
  using (public.is_dealer());

create policy "Estado: atualização dealer"
  on public.player_game_state for update
  using (auth.uid() = user_id and public.is_dealer())
  with check (auth.uid() = user_id and public.is_dealer());
