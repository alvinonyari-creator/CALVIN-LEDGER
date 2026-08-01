-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
-- Use this file only for a BRAND NEW Supabase project. If you already created
-- the expenses table from an earlier version of this app, run
-- supabase-schema-v2.sql instead — it upgrades the existing table in place.

create table obligations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  total_amount numeric not null,
  created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  category text not null,
  recipient text not null,
  note text default '',
  date timestamptz not null,
  obligation_id uuid references obligations(id) on delete set null,
  created_at timestamptz default now()
);

-- Row Level Security: required by Supabase before the anon key can touch these tables.
-- These policies allow anyone with your anon key (i.e. anyone with the deployed app URL)
-- to read/write/delete. There is no per-user login — only use this for data you're
-- comfortable being editable by anyone who has the link to your deployed app.
alter table expenses enable row level security;
alter table obligations enable row level security;

create policy "Allow anon read expenses" on expenses for select using (true);
create policy "Allow anon insert expenses" on expenses for insert with check (true);
create policy "Allow anon update expenses" on expenses for update using (true);
create policy "Allow anon delete expenses" on expenses for delete using (true);

create policy "Allow anon read obligations" on obligations for select using (true);
create policy "Allow anon insert obligations" on obligations for insert with check (true);
create policy "Allow anon delete obligations" on obligations for delete using (true);
