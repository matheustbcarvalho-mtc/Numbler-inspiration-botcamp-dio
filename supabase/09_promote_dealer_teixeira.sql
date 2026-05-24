-- Promover teixeira.twitchtv@gmail.com a dealer
-- Execute no SQL Editor do Supabase (o usuário precisa já existir em Authentication)

update public.profiles p
set
  role = 'dealer'::public.user_role,
  email = coalesce(p.email, u.email)
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('teixeira.twitchtv@gmail.com');

-- Se ainda não houver linha em profiles (conta criada antes do trigger):
insert into public.profiles (id, email, display_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
  'dealer'::public.user_role
from auth.users u
where lower(u.email) = lower('teixeira.twitchtv@gmail.com')
  and not exists (select 1 from public.profiles p where p.id = u.id);

-- Garantir estado do jogo
insert into public.player_game_state (user_id)
select u.id
from auth.users u
where lower(u.email) = lower('teixeira.twitchtv@gmail.com')
  and not exists (
    select 1 from public.player_game_state g where g.user_id = u.id
  );

-- Conferir
select p.id, p.email, p.role, p.display_name
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('teixeira.twitchtv@gmail.com');
