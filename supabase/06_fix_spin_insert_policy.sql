-- Garante que giros possam ser inseridos por usuários autenticados (próprio user_id).
-- Complementa a política "Giros: inserção dealer".

drop policy if exists "Giros: inserção própria" on public.spins;
create policy "Giros: inserção própria"
  on public.spins for insert
  with check (auth.uid() = user_id);

-- Confirme que você é dealer:
-- update public.profiles set role = 'dealer' where email = 'matheus.tbcarvalho@gmail.com';
