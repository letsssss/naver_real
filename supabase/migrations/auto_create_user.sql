-- auth.users에 새 사용자가 생성될 때 자동으로 public.users에도 삽입하는 트리거

-- 1. 트리거 함수 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'USER',
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, public.users.name),
    updated_at = excluded.updated_at;
  
  return new;
end;
$$ language plpgsql security definer;

-- 2. 트리거 생성
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. 기존 auth.users에 있지만 public.users에 없는 사용자들 자동 동기화
insert into public.users (id, email, name, role, created_at, updated_at)
select 
  au.id,
  au.email,
  coalesce(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name', 
    split_part(au.email, '@', 1)
  ) as name,
  'USER' as role,
  au.created_at,
  au.updated_at
from auth.users au
left join public.users pu on au.id = pu.id
where pu.id is null
on conflict (id) do nothing; 