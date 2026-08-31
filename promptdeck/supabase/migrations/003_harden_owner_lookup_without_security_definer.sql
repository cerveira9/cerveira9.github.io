revoke all on table public.promptdeck_owner from anon, authenticated;
grant select on table public.promptdeck_owner to authenticated;

drop policy if exists "promptdeck_owner_select_self" on public.promptdeck_owner;
create policy "promptdeck_owner_select_self"
on public.promptdeck_owner
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.is_promptdeck_owner()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.promptdeck_owner o
    where o.singleton = true
      and o.user_id = auth.uid()
  );
$$;

revoke all on function public.is_promptdeck_owner() from public;
revoke all on function public.is_promptdeck_owner() from anon;
grant execute on function public.is_promptdeck_owner() to authenticated;
