alter table public.vaults
  add column if not exists revision bigint not null default 0;
