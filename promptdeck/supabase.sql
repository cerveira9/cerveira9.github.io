-- PromptDeck: banco com ciphertext-only + allowlist server-side + RLS.
-- Após executar esta migration, adicione seu e-mail em allowed_users pelo SQL Editor.
-- Não coloque e-mail pessoal, senha, prompt ou segredo no GitHub.

create table if not exists public.allowed_users (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint allowed_users_email_normalized check (email = lower(trim(email)))
);

alter table public.allowed_users enable row level security;
revoke all on table public.allowed_users from anon, authenticated;

create or replace function public.is_promptdeck_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_promptdeck_allowed() from public;
grant execute on function public.is_promptdeck_allowed() to authenticated;

create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  envelope jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vaults_one_per_user unique (user_id),
  constraint vault_envelope_is_object check (jsonb_typeof(envelope) = 'object')
);

alter table public.vaults enable row level security;
revoke all on table public.vaults from anon;
grant select, insert, update, delete on table public.vaults to authenticated;

drop policy if exists "vault_select_owner" on public.vaults;
drop policy if exists "vault_insert_owner" on public.vaults;
drop policy if exists "vault_update_owner" on public.vaults;
drop policy if exists "vault_delete_owner" on public.vaults;

create policy "vault_select_owner" on public.vaults
for select to authenticated
using (public.is_promptdeck_allowed() and (select auth.uid()) = user_id);

create policy "vault_insert_owner" on public.vaults
for insert to authenticated
with check (public.is_promptdeck_allowed() and (select auth.uid()) = user_id);

create policy "vault_update_owner" on public.vaults
for update to authenticated
using (public.is_promptdeck_allowed() and (select auth.uid()) = user_id)
with check (public.is_promptdeck_allowed() and (select auth.uid()) = user_id);

create policy "vault_delete_owner" on public.vaults
for delete to authenticated
using (public.is_promptdeck_allowed() and (select auth.uid()) = user_id);

-- Execute manualmente no SQL Editor depois da migration:
-- insert into public.allowed_users(email) values ('seu-email@exemplo.com');
