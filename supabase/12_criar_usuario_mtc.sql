-- Use SOMENTE se criou o usuário em Authentication → Users (Auto Confirm User)
-- E-mail: mtc.mat.30@gmail.com

insert into public.profiles (id, email, display_name, role)
select
  u.id,
  u.email,
  'matheus.mtc30',
  'dealer'::public.user_role
from auth.users u
where u.email = 'mtc.mat.30@gmail.com'
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  role = excluded.role;

insert into public.player_game_state (user_id)
select u.id
from auth.users u
where u.email = 'mtc.mat.30@gmail.com'
on conflict do nothing;

select p.id, p.email, p.role, p.display_name
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'mtc.mat.30@gmail.com';
