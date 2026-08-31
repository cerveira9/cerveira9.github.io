create table if not exists public.promptdeck_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.promptdeck_owner enable row level security;
revoke all on table public.promptdeck_owner from anon, authenticated;

do $$
declare
  auth_user_count integer;
begin
  select count(*) into auth_user_count from auth.users;
  if auth_user_count <> 1 then
    raise exception 'Expected exactly one auth user before owner lock, found %', auth_user_count;
  end if;

  if not exists (select 1 from public.promptdeck_owner where singleton = true) then
    insert into public.promptdeck_owner (singleton, user_id)
    select true, id from auth.users order by created_at asc limit 1;
  end if;
end $$;

create or replace function public.is_promptdeck_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.promptdeck_owner o
    where o.singleton = true and o.user_id = auth.uid()
  );
$$;

revoke all on function public.is_promptdeck_owner() from public;
grant execute on function public.is_promptdeck_owner() to authenticated;

drop policy if exists "vaults_select_own" on public.vaults;
drop policy if exists "vaults_insert_own" on public.vaults;
drop policy if exists "vaults_update_own" on public.vaults;
drop policy if exists "vaults_delete_own" on public.vaults;

create policy "vaults_owner_select" on public.vaults for select to authenticated
using (public.is_promptdeck_owner() and (select auth.uid()) = user_id);

create policy "vaults_owner_insert" on public.vaults for insert to authenticated
with check (public.is_promptdeck_owner() and (select auth.uid()) = user_id);

create policy "vaults_owner_update" on public.vaults for update to authenticated
using (public.is_promptdeck_owner() and (select auth.uid()) = user_id)
with check (public.is_promptdeck_owner() and (select auth.uid()) = user_id);

create policy "vaults_owner_delete" on public.vaults for delete to authenticated
using (public.is_promptdeck_owner() and (select auth.uid()) = user_id);
