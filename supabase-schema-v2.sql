-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
-- If you already ran the original supabase-schema.sql, run this instead of
-- starting over — it creates the new obligations table and adds the missing
-- update policy and obligation_id column onto the existing expenses table.

create table if not exists obligations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  total_amount numeric not null,
  created_at timestamptz default now()
);

alter table obligations enable row level security;

create policy "Allow anon read obligations" on obligations
  for select using (true);
create policy "Allow anon insert obligations" on obligations
  for insert with check (true);
create policy "Allow anon delete obligations" on obligations
  for delete using (true);

-- If expenses.date is currently a plain "date" column, this widens it to store
-- time as well, matching the app's date+time editing feature.
alter table expenses alter column date type timestamptz using date::timestamptz;

-- Links a payment entry back to the obligation it was made toward.
alter table expenses add column if not exists obligation_id uuid references obligations(id) on delete set null;

-- The original schema didn't allow editing entries. This adds it.
create policy "Allow anon update expenses" on expenses
  for update using (true);
