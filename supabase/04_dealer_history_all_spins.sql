-- Dealers podem ver TODOS os giros no histórico (não só os próprios).
-- Execute no SQL Editor do Supabase.

create policy "Giros: leitura todos dealers"
  on public.spins for select
  using (public.is_dealer());
